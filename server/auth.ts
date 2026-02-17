// Email/password authentication system - based on blueprint:javascript_auth_all_persistance
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { users } from "@shared/schema";
import { z } from "zod";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      isAdmin: boolean;
      role?: string | null;
      photographerStatus?: string | null;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["client", "photographer"]).default("client"),
  photographerProfile: z.object({
    displayName: z.string().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    specialties: z.array(z.string()).optional(),
    portfolioLinks: z.array(z.string()).optional(),
    pricing: z.string().optional(),
    availability: z.string().optional(),
    phone: z.string().optional(),
    socials: z.record(z.string()).optional(),
    verificationDocs: z.array(z.string()).optional(),
  }).optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export function setupPasswordAuth(app: Express) {
  // Configure passport to use email as username field
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' }, // Use email instead of username
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !user.password || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: 'Invalid email or password' });
          }
          
          // Return user without password - handle nullable fields
          const userWithoutPassword = {
            id: user.id,
            email: user.email || '', // Handle nullable email
            firstName: user.firstName,
            lastName: user.lastName,
            isAdmin: user.isAdmin || false,
            role: user.role,
            photographerStatus: user.photographerStatus,
          };

          return done(null, userWithoutPassword);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      if (user && user.email) {
        const userWithoutPassword = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin || false,
          role: user.role,
          photographerStatus: user.photographerStatus,
        };
        done(null, userWithoutPassword);
      } else {
        done(null, false);
      }
    } catch (error) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      // Check if this will be the first user (make them admin)
      const adminCount = await storage.getAdminCount();
      const isFirstUser = adminCount === 0;

      const hashedPassword = await hashPassword(validatedData.password);
      
      const user = await storage.createUser({
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        profileImageUrl: null,
        isAdmin: isFirstUser,
        role: validatedData.role,
        photographerStatus: validatedData.role === "photographer" ? "pending" : null,
      });

      if (validatedData.role === "photographer") {
        await storage.createPhotographerProfile({
          userId: user.id,
          displayName: validatedData.photographerProfile?.displayName,
          bio: validatedData.photographerProfile?.bio,
          location: validatedData.photographerProfile?.location,
          specialties: validatedData.photographerProfile?.specialties ?? [],
          portfolioLinks: validatedData.photographerProfile?.portfolioLinks ?? [],
          pricing: validatedData.photographerProfile?.pricing,
          availability: validatedData.photographerProfile?.availability,
          phone: validatedData.photographerProfile?.phone,
          socials: validatedData.photographerProfile?.socials ?? {},
          verificationDocs: validatedData.photographerProfile?.verificationDocs ?? [],
        });
      }

      if (isFirstUser) {
        console.log(`First admin user created: ${user.email}`);
      }

      // Auto-login after registration - create safe user object for passport
      const safeUser = {
        id: user.id,
        email: user.email || '',
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin || false,
        role: user.role,
        photographerStatus: user.photographerStatus,
      };
      
      req.login(safeUser, (err) => {
        if (err) return next(err);
        
        const userResponse = {
          id: user.id,
          email: user.email || '',
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin || false,
          role: user.role,
          photographerStatus: user.photographerStatus,
        };
        
        res.status(201).json(userResponse);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed",
          details: error.errors 
        });
      }
      console.error('Registration error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: "Registration failed", details: errMsg });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed",
          details: error.errors 
        });
      }
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: "Login failed" });
      }
      
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid email or password" });
      }

      req.login(user, (err) => {
        if (err) {
          console.error('Login session error:', err);
          return res.status(500).json({ error: "Login failed" });
        }
        res.json(user);
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json(req.user);
  });

  // Forgot password endpoint
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({ message: "If an account with that email exists, a password reset link has been sent." });
      }

      // Generate reset token (simple approach - in production, use crypto.randomBytes)
      const resetToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token with user (we'll need to add this to storage interface)
      await storage.createPasswordResetToken(user.id, resetToken, expiresAt);

      // In a real app, you'd send an email here
      // For now, we'll just log it
      console.log(`Password reset token for ${user.email}: ${resetToken}`);
      console.log(`Reset link: http://localhost:5000/auth?reset=${resetToken}`);

      res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed",
          details: error.errors 
        });
      }
      console.error('Forgot password error:', error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Reset password endpoint
  app.post("/api/reset-password", async (req, res) => {
    try {
      const validatedData = resetPasswordSchema.parse(req.body);
      
      // Verify reset token
      const tokenData = await storage.getPasswordResetToken(validatedData.token);
      if (!tokenData || new Date() > tokenData.expiresAt) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Update user password
      const hashedPassword = await hashPassword(validatedData.password);
      await storage.updateUserPassword(tokenData.userId, hashedPassword);

      // Delete the used token
      await storage.deletePasswordResetToken(validatedData.token);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation failed",
          details: error.errors 
        });
      }
      console.error('Reset password error:', error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });
}