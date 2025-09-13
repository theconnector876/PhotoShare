import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Shield, User, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

export default function Login() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !isLoading) {
      // Redirect based on admin status
      if (user.isAdmin) {
        setLocation("/admin");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, isLoading, setLocation]);

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  if (isLoading) {
    return (
      <div className="pt-16 pb-20 bg-background relative z-10">
        <div className="max-w-md mx-auto px-4 mt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 pb-20 bg-background relative z-10">
      <div className="max-w-md mx-auto px-4 mt-20">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-jamaica-green to-jamaica-yellow flex items-center justify-center mx-auto mb-4">
            <Camera className="text-white text-2xl" />
          </div>
          <h1 className="text-3xl font-bold font-serif mb-2 gradient-text">
            Welcome Back
          </h1>
          <p className="text-muted-foreground">
            Sign in to access your bookings and galleries
          </p>
        </div>

        <Card className="p-8 hover-3d">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">Choose Your Access Level</h2>
            </div>

            {/* User Access */}
            <div className="bg-muted p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <User className="text-primary mr-3" size={24} />
                <div>
                  <h3 className="font-semibold">Client Dashboard</h3>
                  <p className="text-sm text-muted-foreground">View your bookings and galleries</p>
                </div>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li>• Track your booking status</li>
                <li>• Access your photo galleries</li>
                <li>• Download your final images</li>
                <li>• View booking history</li>
              </ul>
            </div>

            {/* Admin Access */}
            <div className="bg-muted p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <Shield className="text-jamaica-gold mr-3" size={24} />
                <div>
                  <h3 className="font-semibold">Admin Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Manage all business operations</p>
                </div>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li>• Manage all client bookings</li>
                <li>• Upload and organize galleries</li>
                <li>• View business analytics</li>
                <li>• Handle contact messages</li>
              </ul>
            </div>

            <Button 
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-primary to-secondary text-white py-4 text-lg font-semibold magnetic-btn animate-glow"
              data-testid="button-login"
            >
              <BarChart3 className="mr-2" size={20} />
              Sign In with Replit
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <p>Secure authentication powered by Replit</p>
              <p className="mt-2">
                New client? Your account will be created automatically after your first booking.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}