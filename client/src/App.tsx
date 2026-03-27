import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SiteConfigProvider } from "@/context/site-config";
import { CurrencyProvider } from "@/context/currency";
import { ProtectedRoute } from "@/lib/protected-route";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import Navigation from "@/components/navigation";
import ConstellationBackground from "@/components/constellation-background";
import { useNativePush } from "@/hooks/use-native-push";

// Lazy-loaded pages — each splits into its own chunk, only loaded when visited
const Home                  = lazy(() => import("@/pages/home"));
const Portfolio             = lazy(() => import("@/pages/portfolio"));
const Booking               = lazy(() => import("@/pages/booking"));
const PhotographerBooking   = lazy(() => import("@/pages/photographer-booking"));
const PhotographerProfile   = lazy(() => import("@/pages/photographer-profile"));
const About                 = lazy(() => import("@/pages/about"));
const Contact               = lazy(() => import("@/pages/contact"));
const Gallery               = lazy(() => import("@/pages/gallery"));
const AuthPage              = lazy(() => import("@/pages/auth-page"));
const Dashboard             = lazy(() => import("@/pages/dashboard"));
const PhotographerDashboard = lazy(() => import("@/pages/photographer-dashboard"));
const AdminDashboard        = lazy(() => import("@/pages/admin-dashboard").then((m) => ({ default: m.AdminDashboard })));
const Payment               = lazy(() => import("@/pages/payment"));
const PaymentSuccess        = lazy(() => import("@/pages/payment-success").then((m) => ({ default: m.PaymentSuccess })));
const CheckoutOverlay       = lazy(() => import("@/pages/checkout-overlay"));
const Blog                  = lazy(() => import("@/pages/blog"));
const BlogPost              = lazy(() => import("@/pages/blog-post"));
const Terms                 = lazy(() => import("@/pages/terms"));
const Privacy               = lazy(() => import("@/pages/privacy"));
const NotFound              = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/portfolio" component={Portfolio} />
        <Route path="/booking" component={Booking} />
        <Route path="/book/:photographerId" component={PhotographerBooking} />
        <Route path="/photographer/:photographerId" component={PhotographerProfile} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/gallery/:email/:code" component={Gallery} />
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogPost} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/auth" component={AuthPage} />
        <ProtectedRoute path="/dashboard" component={Dashboard} />
        <ProtectedRoute path="/photographer" component={PhotographerDashboard} />
        <ProtectedRoute path="/admin" component={AdminDashboard} requireAdmin />
        <Route path="/payment" component={Payment} />
        <Route path="/payment-success" component={PaymentSuccess} />
        <Route path="/checkout/custom/:id" component={CheckoutOverlay} />
        <Route path="/checkout/:rest*" component={CheckoutOverlay} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function NativePushSetup() {
  const { user } = useAuth();
  useNativePush(!!user);
  return null;
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <SiteConfigProvider>
          <CurrencyProvider>
          <AuthProvider>
            <NativePushSetup />
            <TooltipProvider>
              <div className="min-h-screen relative flex flex-col">
                <ConstellationBackground />
                <Navigation />
                <div className="flex-1">
                  <Router />
                </div>
                <footer className="relative z-10 border-t bg-background/80 backdrop-blur-sm py-4 px-6">
                  <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>© {new Date().getFullYear()} ConnectAGrapher. All rights reserved.</span>
                    <div className="flex gap-4">
                      <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
                      <a href="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</a>
                      <a href="/contact" className="hover:text-foreground transition-colors">Contact</a>
                    </div>
                  </div>
                </footer>
                <Toaster />
                <Analytics />
              </div>
            </TooltipProvider>
          </AuthProvider>
          </CurrencyProvider>
        </SiteConfigProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
