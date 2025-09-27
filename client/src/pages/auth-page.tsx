// Authentication page with login and signup - based on blueprint:javascript_auth_all_persistance
import { useState } from "react";
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
import { Camera, Heart, Users, LogIn, UserPlus } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);

  // Redirect if already logged in (after hook calls to avoid rules of hooks violation)
  if (user) {
    return <Redirect to="/" />;
  }

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
    },
  });

  const onLogin = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex">
      {/* Left Column - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold gradient-text">The Connector</h1>
            <p className="text-muted-foreground mt-2">
              {isLoginMode ? "Welcome back!" : "Create your account"}
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex mb-6 bg-muted rounded-lg p-1">
            <Button
              type="button"
              variant={isLoginMode ? "default" : "ghost"}
              className="flex-1 text-sm"
              onClick={() => setIsLoginMode(true)}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
            <Button
              type="button"
              variant={!isLoginMode ? "default" : "ghost"}
              className="flex-1 text-sm"
              onClick={() => setIsLoginMode(false)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Sign Up
            </Button>
          </div>

          {/* Login Form */}
          {isLoginMode && (
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
          {!isLoginMode && (
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
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
                      <FormLabel>Password</FormLabel>
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
        </Card>
      </div>

      {/* Right Column - Hero Section */}
      <div className="flex-1 hidden lg:flex items-center justify-center p-8 bg-gradient-to-br from-primary to-secondary text-white">
        <div className="max-w-lg text-center">
          <div className="mb-8">
            <div className="flex justify-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Camera className="w-8 h-8" />
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8" />
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8" />
              </div>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold mb-4">Capture Your Moments</h2>
          <p className="text-xl mb-6 text-white/90">
            Professional photography services for weddings, events, and portrait sessions in Jamaica
          </p>
          
          <div className="space-y-3 text-white/80">
            <div className="flex items-center justify-center">
              <Camera className="w-5 h-5 mr-2" />
              <span>Professional photography & videography</span>
            </div>
            <div className="flex items-center justify-center">
              <Heart className="w-5 h-5 mr-2" />
              <span>Wedding and event coverage</span>
            </div>
            <div className="flex items-center justify-center">
              <Users className="w-5 h-5 mr-2" />
              <span>Portrait and group sessions</span>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-white/10 rounded-lg">
            <p className="text-sm">
              Create an account to book your session, access your photo galleries, 
              and manage your bookings with ease.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}