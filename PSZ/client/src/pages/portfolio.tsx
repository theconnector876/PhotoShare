import PortfolioGrid from "@/components/portfolio-grid";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Portfolio() {
  return (
    <div className="pt-20 pb-20 relative z-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold font-serif mb-4 gradient-text slide-in-up" data-testid="portfolio-main-title">
            Our Portfolio
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto slide-in-up stagger-1">
            Explore our collection of captured moments across Jamaica's most beautiful locations
          </p>
        </div>

        <PortfolioGrid />

        <div className="text-center mt-16">
          <Link href="/booking">
            <Button 
              className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-4 rounded-lg font-semibold text-lg magnetic-btn animate-glow"
              data-testid="button-book-from-portfolio"
            >
              <i className="fas fa-calendar-plus mr-2"></i>
              Book Your Session Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
