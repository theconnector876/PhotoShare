// Authentication page with login and signup
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Camera, Heart, Users, LogIn, UserPlus, ArrowLeft, Upload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["client", "photographer"]).default("client"),
  displayName: z.string().optional(),
  bio: z.string().optional(),
  location: z.string().optional(),
  specialties: z.string().optional(),
  portfolioLinks: z.string().optional(),
  pricing: z.string().optional(),
  availability: z.string().optional(),
  phone: z.string().optional(),
  socials: z.string().optional(),
  verificationDocs: z.string().optional(),
  catalogueId: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  const { toast } = useToast();

  // Photographer ID verification state
  const [idType, setIdType] = useState('passport');
  const [idPhotoUrl, setIdPhotoUrl] = useState('');
  const [idPhotoUploading, setIdPhotoUploading] = useState(false);

  // Fetch catalogues for photographer assignment
  const { data: catalogues } = useQuery<{ id: string; title: string; serviceType: string }[]>({
    queryKey: ['/api/catalogues'],
  });

  // Auto-detect catalogue from URL params (when coming from a gallery)
  const urlCatalogueId = new URLSearchParams(window.location.search).get('catalogue') || '';
  
  // Check if this is a password reset link
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset');
  
  // Set mode to reset if we have a reset token
  useEffect(() => {
    if (resetToken) {
      setMode('reset');
    }
  }, [resetToken]);

  // Pre-fill catalogueId if coming from a gallery URL
  useEffect(() => {
    if (urlCatalogueId) {
      registerForm.setValue('catalogueId', urlCatalogueId);
    }
  }, [urlCatalogueId]);

  // Forgot password mutation
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send reset email");
      }
      return response.json();
    },
    onSuccess: () => {
      setForgotPasswordMessage("If an account with that email exists, a password reset link has been sent.");
      toast({
        title: "Check your email",
        description: "If an account with that email exists, a password reset link has been sent.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, token: resetToken }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: "Your password has been updated. You can now log in.",
      });
      setMode('login');
      // Clear the reset token from URL
      window.history.replaceState({}, '', '/auth');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "client",
      displayName: "",
      bio: "",
      location: "",
      specialties: "",
      portfolioLinks: "",
      pricing: "",
      availability: "",
      phone: "",
      socials: "",
      verificationDocs: "",
      catalogueId: "",
    },
  });

  const registerRole = registerForm.watch("role");

  const uploadIdPhoto = async (file: File) => {
    setIdPhotoUploading(true);
    try {
      const sigRes = await fetch('/api/upload-id-signature', { method: 'POST' });
      if (!sigRes.ok) throw new Error('Upload not configured');
      const { cloudName, apiKey, timestamp, signature, folder } = await sigRes.json();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);
      formData.append('folder', folder);
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { secure_url } = await uploadRes.json();
      setIdPhotoUrl(secure_url);
      toast({ title: "ID photo uploaded successfully" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIdPhotoUploading(false);
    }
  };

  const onLogin = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const parseCsv = (value?: string) =>
    value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
  const parseSocials = (value?: string) => {
    if (!value) return {};
    return value.split(",").reduce<Record<string, string>>((acc, entry) => {
      const [key, rawVal] = entry.split(":");
      if (key && rawVal) {
        acc[key.trim()] = rawVal.trim();
      }
      return acc;
    }, {});
  };

  const onRegister = (data: RegisterFormData) => {
    if (data.role === 'photographer' && !idPhotoUrl) {
      toast({ title: "ID Photo Required", description: "Please upload a photo of your ID for verification.", variant: "destructive" });
      return;
    }
    const baseSocials = parseSocials(data.socials);
    const payload = {
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      photographerProfile: data.role === "photographer" ? {
        displayName: data.displayName,
        bio: data.bio,
        location: data.location,
        specialties: parseCsv(data.specialties),
        portfolioLinks: parseCsv(data.portfolioLinks),
        pricing: data.pricing,
        availability: data.availability,
        phone: data.phone,
        socials: data.catalogueId ? { ...baseSocials, catalogueId: data.catalogueId } : baseSocials,
        verificationDocs: idPhotoUrl ? [idType, idPhotoUrl] : [],
      } : undefined,
    };
    registerMutation.mutate(payload);
  };

  // Redirect if already logged in (after all hooks to avoid rules of hooks violation)
  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — always-dark editorial panel */}
      <div className="hidden lg:flex relative flex-col justify-between w-[42%] bg-[hsl(222,20%,5%)] p-12 overflow-hidden">
        {/* Amber glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)' }} />
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-[12px] bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Camera className="w-4.5 h-4.5 text-black" />
          </div>
          <span className="text-white font-bold text-[15px]" style={{ fontFamily: 'var(--font-display, sans-serif)' }}>ConnectAGrapher</span>
        </div>
        {/* Main content */}
        <div className="relative z-10 space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <p className="eyebrow mb-4">Professional Photography</p>
            <h2 className="text-white font-black leading-tight mb-4" style={{ fontFamily: 'var(--font-display, var(--font-serif))', fontSize: 'clamp(1.8rem, 3vw, 2.6rem)' }}>
              Capture Every<br /><span className="text-gradient-gold">Precious Moment</span>
            </h2>
            <p className="text-white/40 text-[14px] leading-relaxed max-w-sm">
              Premium photography &amp; videography for weddings, events, portraits, and more across Jamaica.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }} className="space-y-3">
            {[{ icon: '📸', text: 'Professional photographers &amp; videographers' }, { icon: '💍', text: 'Wedding and event specialists' }, { icon: '🖼️', text: 'Access your private photo gallery' }].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-base">{item.icon}</span>
                <span className="text-white/50 text-[13px]" dangerouslySetInnerHTML={{ __html: item.text }} />
              </div>
            ))}
          </motion.div>
        </div>
        {/* Bottom quote */}
        <p className="relative z-10 text-white/20 text-[12px] italic">
          "Every photo tells a story worth telling."
        </p>
      </div>

      {/* Right Column - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 overflow-y-auto">
        <Card className="w-full max-w-md p-8 border-border/60 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Camera className="w-5 h-5 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display, var(--font-serif))' }}>
              {mode === 'login' && 'Welcome Back'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset' && 'New Password'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === 'login' && 'Sign in to your account'}
              {mode === 'register' && 'Join ConnectAGrapher today'}
              {mode === 'forgot' && 'Enter your email to receive a reset link'}
              {mode === 'reset' && 'Choose a secure new password'}
            </p>
          </div>

          {/* Mode Toggle - only show for login/register */}
          {(mode === 'login' || mode === 'register') && (
            <div className="flex mb-6 bg-muted rounded-lg p-1">
              <Button
                type="button"
                variant={mode === 'login' ? "default" : "ghost"}
                className="flex-1 text-sm"
                onClick={() => setMode('login')}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Login
              </Button>
              <Button
                type="button"
                variant={mode === 'register' ? "default" : "ghost"}
                className="flex-1 text-sm"
                onClick={() => setMode('register')}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Sign Up
              </Button>
            </div>
          )}

          {/* Back button for forgot/reset modes */}
          {(mode === 'forgot' || mode === 'reset') && (
            <Button
              type="button"
              variant="ghost"
              className="mb-4"
              onClick={() => setMode('login')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your.email@example.com"
                          data-testid="input-login-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          data-testid="input-login-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </Form>
          )}

          {/* Register Form */}
          {/* Register Form */}
          {mode === 'register' && (
            <Form {...registerForm}>
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={registerForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John"
                            data-testid="input-register-firstname"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Doe"
                            data-testid="input-register-lastname"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={registerForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={field.value === "client" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => field.onChange("client")}
                          >
                            Client
                          </Button>
                          <Button
                            type="button"
                            variant={field.value === "photographer" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => field.onChange("photographer")}
                          >
                            Photographer
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your.email@example.com"
                          data-testid="input-register-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Create a secure password"
                          data-testid="input-register-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {registerRole === "photographer" && (
                  <>
                    <FormField
                      control={registerForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Studio Name"
                              data-testid="input-register-displayname"
                              required
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+1 876 ..."
                              data-testid="input-register-phone"
                              required
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Short bio"
                              data-testid="input-register-bio"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location / Service Area</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Kingston, JA"
                              data-testid="input-register-location"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="specialties"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialties (comma-separated)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Wedding, Portrait, Events"
                              data-testid="input-register-specialties"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="portfolioLinks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Portfolio Links (comma-separated)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://site.com, https://instagram.com/..."
                              data-testid="input-register-portfolio"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="socials"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Socials (comma-separated key:value)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="instagram:@handle, facebook:page"
                              data-testid="input-register-socials"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* ID Verification */}
                    <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                      <Label className="text-sm font-semibold">ID Verification</Label>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">ID Type</Label>
                        <Select value={idType} onValueChange={setIdType}>
                          <SelectTrigger data-testid="select-id-type">
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="passport">Passport</SelectItem>
                            <SelectItem value="drivers_license">Driver's License</SelectItem>
                            <SelectItem value="national_id">National ID</SelectItem>
                            <SelectItem value="tax_registration">Tax Registration</SelectItem>
                            <SelectItem value="business_registration">Business Registration</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Upload ID Photo</Label>
                        <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-lg p-3 hover:border-primary transition-colors">
                          <Upload className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {idPhotoUploading ? "Uploading..." : idPhotoUrl ? "Photo uploaded ✓" : "Click to upload ID photo"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            data-testid="input-id-photo"
                            disabled={idPhotoUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadIdPhoto(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Catalogue Assignment */}
                    <FormField
                      control={registerForm.control}
                      name="catalogueId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assign to Catalogue</FormLabel>
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-catalogue">
                                <SelectValue placeholder="Select a catalogue (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {catalogues?.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.title} ({cat.serviceType})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </Form>
          )}

          {/* Add forgot password forms */}
          {mode === 'login' && (
            <div className="mt-4 text-center">
              <Button
                type="button"
                variant="link"
                className="text-sm"
                onClick={() => setMode('forgot')}
              >
                Forgot your password?
              </Button>
            </div>
          )}

          {/* Forgot Password Form */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {forgotPasswordMessage ? (
                <div className="text-center space-y-4">
                  <p className="text-amber-400">{forgotPasswordMessage}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode('login')}
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const email = formData.get('email') as string;
                  if (email) {
                    forgotPasswordMutation.mutate({ email });
                  }
                }} className="space-y-4">
                  <div>
                    <Label htmlFor="forgot-email">Email Address</Label>
                    <Input
                      id="forgot-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email address"
                      required
                      data-testid="input-forgot-email"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={forgotPasswordMutation.isPending}
                    data-testid="button-forgot-password"
                  >
                    {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Reset Password Form */}
          {mode === 'reset' && resetToken && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const password = formData.get('password') as string;
              const confirmPassword = formData.get('confirmPassword') as string;
              if (password && confirmPassword) {
                resetPasswordMutation.mutate({ password, confirmPassword });
              }
            }} className="space-y-4">
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  name="password"
                  type="password"
                  placeholder="Enter your new password"
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  required
                  data-testid="input-confirm-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordMutation.isPending}
                data-testid="button-reset-password"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}
        </Card>
      </div>

    </div>
  );
}