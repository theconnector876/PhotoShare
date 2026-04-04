import { Switch, Route } from "wouter";
import { lazy, Suspense, useEffect, useState } from "react";
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
import { useNativePush } from "@/hooks/use-native-push";
import { FullPageLoader } from "@/components/aperture-loader";
import { CustomCursor } from "@/components/custom-cursor";
import { Link } from "wouter";
import { InstagramLogo, FacebookLogo, TwitterLogo, Camera } from "@phosphor-icons/react";

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
const PromotionPage         = lazy(() => import("@/pages/promotion"));

function Router() {
  return (
    <Suspense fallback={<FullPageLoader />}>
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
        <Route path="/promotions/:id" component={PromotionPage} />
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

/** Syncs the Tailwind `dark` class on <html> to the OS color scheme. */
function ThemeSyncer() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return null;
}

function ScrollProgress() {
  const [scaleX, setScaleX] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setScaleX(total > 0 ? window.scrollY / total : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      className="scroll-progress-bar"
      style={{ transform: `scaleX(${scaleX})` }}
    />
  );
}

function PremiumFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative z-10 bg-[#070709] border-t border-white/[0.06] text-white/60 overflow-hidden">
      {/* Ambient blob */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full"
        style={{ background: 'radial-gradient(ellipse, rgba(245,158,11,0.07) 0%, transparent 70%)', pointerEvents: 'none' }}
      />

      <div className="max-w-6xl mx-auto px-6 pt-14 pb-10">
        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[10px] bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Camera size={16} weight="duotone" className="text-black" />
              </div>
              <span className="text-white font-bold text-[15px] tracking-tight" style={{ fontFamily: 'var(--font-display, sans-serif)' }}>
                ConnectAGrapher
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-white/40 mb-5 max-w-[220px]">
              Premium photography &amp; videography studio based in Jamaica.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-8 h-8 rounded-full bg-white/6 hover:bg-amber-500/20 hover:text-amber-400 flex items-center justify-center transition-colors" aria-label="Instagram">
                <InstagramLogo size={14} weight="duotone" />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/6 hover:bg-amber-500/20 hover:text-amber-400 flex items-center justify-center transition-colors" aria-label="Facebook">
                <FacebookLogo size={14} weight="duotone" />
              </a>
              <a href="#" className="w-8 h-8 rounded-full bg-white/6 hover:bg-amber-500/20 hover:text-amber-400 flex items-center justify-center transition-colors" aria-label="Twitter">
                <TwitterLogo size={14} weight="duotone" />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/25 mb-4">Services</p>
            <ul className="space-y-2.5 text-[13px]">
              <li><Link href="/booking"><span className="hover:text-amber-400 transition-colors cursor-pointer">Wedding Photography</span></Link></li>
              <li><Link href="/booking"><span className="hover:text-amber-400 transition-colors cursor-pointer">Portrait Sessions</span></Link></li>
              <li><Link href="/booking"><span className="hover:text-amber-400 transition-colors cursor-pointer">Event Coverage</span></Link></li>
              <li><Link href="/booking"><span className="hover:text-amber-400 transition-colors cursor-pointer">Videography</span></Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/25 mb-4">Company</p>
            <ul className="space-y-2.5 text-[13px]">
              <li><Link href="/about"><span className="hover:text-amber-400 transition-colors cursor-pointer">About Us</span></Link></li>
              <li><Link href="/portfolio"><span className="hover:text-amber-400 transition-colors cursor-pointer">Portfolio</span></Link></li>
              <li><Link href="/blog"><span className="hover:text-amber-400 transition-colors cursor-pointer">Blog</span></Link></li>
              <li><Link href="/contact"><span className="hover:text-amber-400 transition-colors cursor-pointer">Contact</span></Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/25 mb-4">Legal</p>
            <ul className="space-y-2.5 text-[13px]">
              <li><Link href="/privacy"><span className="hover:text-amber-400 transition-colors cursor-pointer">Privacy Policy</span></Link></li>
              <li><Link href="/terms"><span className="hover:text-amber-400 transition-colors cursor-pointer">Terms &amp; Conditions</span></Link></li>
              <li><Link href="/gallery"><span className="hover:text-amber-400 transition-colors cursor-pointer">Gallery Access</span></Link></li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-white/30">
          <span>© {year} ConnectAGrapher. All rights reserved.</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            Crafted with passion in Jamaica
          </span>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <SiteConfigProvider>
          <CurrencyProvider>
          <AuthProvider>
            <ThemeSyncer />
            <NativePushSetup />
            <ScrollProgress />
            <CustomCursor />
            <TooltipProvider>
              <div className="min-h-screen relative flex flex-col bg-background">
                <Navigation />
                <div className="flex-1">
                  <Router />
                </div>
                <PremiumFooter />
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
