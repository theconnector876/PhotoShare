import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { SiteConfigProvider } from "@/context/site-config";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import Booking from "@/pages/booking";
import PhotographerBooking from "@/pages/photographer-booking";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Gallery from "@/pages/gallery";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import PhotographerDashboard from "@/pages/photographer-dashboard";
import { AdminDashboard } from "@/pages/admin-dashboard";
import Payment from "@/pages/payment";
import { PaymentSuccess } from "@/pages/payment-success";
import Navigation from "@/components/navigation";
import ConstellationBackground from "@/components/constellation-background";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/booking" component={Booking} />
      <Route path="/book/:photographerId" component={PhotographerBooking} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/gallery/:email/:code" component={Gallery} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/photographer" component={PhotographerDashboard} />
      <ProtectedRoute path="/admin" component={AdminDashboard} requireAdmin />
      <Route path="/payment" component={Payment} />
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteConfigProvider>
        <AuthProvider>
          <TooltipProvider>
            <div className="min-h-screen relative">
              <ConstellationBackground />
              <Navigation />
              <Router />
              <Toaster />
            </div>
          </TooltipProvider>
        </AuthProvider>
      </SiteConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
