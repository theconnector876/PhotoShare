import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import Booking from "@/pages/booking";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Gallery from "@/pages/gallery";
import Navigation from "@/components/navigation";
import ConstellationBackground from "@/components/constellation-background";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/booking" component={Booking} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/gallery" component={Gallery} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen relative">
          <ConstellationBackground />
          <Navigation />
          <Router />
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
