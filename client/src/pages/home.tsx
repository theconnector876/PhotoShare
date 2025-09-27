import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Heart, Users, ChevronDown } from "lucide-react";
import PortfolioGrid from "@/components/portfolio-grid";
import ReviewDisplay from "@/components/review-display";

export default function Home() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative z-10">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1573766064535-6d5d4e62bf9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&h=1380" 
            alt="Beautiful sunset photography session in Jamaica" 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 hero-overlay"></div>
        </div>
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 slide-in-up" data-testid="hero-title">
            Capture Your 
            <span className="gradient-text typewriter block mt-2">Perfect Moment</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 slide-in-up stagger-1 text-white/90" data-testid="hero-subtitle">
            Professional Photography Services across Beautiful Jamaica
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center slide-in-up stagger-2">
            <Link href="/booking" data-testid="link-book-session">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg magnetic-btn animate-glow" data-testid="button-book-session">
                <i className="fas fa-calendar-plus mr-2"></i>
                Book Your Session
              </Button>
            </Link>
            <Link href="/portfolio" data-testid="link-view-portfolio-hero">
              <Button variant="outline" className="border-2 border-primary bg-primary/10 text-primary hover:bg-primary hover:text-white px-8 py-4 rounded-lg font-semibold text-lg magnetic-btn" data-testid="button-view-portfolio">
                <i className="fas fa-images mr-2"></i>
                View Portfolio
              </Button>
            </Link>
          </div>
        </div>

        <div 
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce cursor-pointer"
          onClick={() => scrollToSection('services')}
          data-testid="scroll-indicator"
        >
          <ChevronDown className="text-2xl" />
        </div>
      </section>

      {/* Services Overview */}
      <section id="services" className="py-20 bg-muted relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text" data-testid="services-title">Our Services</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional photography and videography services for every special moment
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Link href="/booking?service=photoshoot" data-testid="link-service-photoshoot">
              <Card className="package-card rounded-2xl p-8 hover-3d cursor-pointer group" data-testid="service-portrait">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center mx-auto mb-6 group-hover:rotate-12 transition-transform duration-300">
                    <Users className="text-white text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 font-serif">Portrait Sessions</h3>
                  <p className="text-muted-foreground mb-6">
                    Personal and professional portraits in stunning Jamaican locations
                  </p>
                  <div className="text-sm text-muted-foreground">
                    Starting from <span className="text-2xl font-bold text-accent">$150</span>
                  </div>
                </div>
              </Card>
            </Link>

            <Link href="/booking?service=wedding" data-testid="link-service-wedding">
              <Card className="package-card rounded-2xl p-8 hover-3d cursor-pointer group" data-testid="service-wedding">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-6 group-hover:rotate-12 transition-transform duration-300">
                    <Heart className="text-white text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 font-serif">Wedding Photography</h3>
                  <p className="text-muted-foreground mb-6">
                    Capture your special day with our comprehensive wedding packages
                  </p>
                  <div className="text-sm text-muted-foreground">
                    Starting from <span className="text-2xl font-bold text-primary">$500</span>
                  </div>
                </div>
              </Card>
            </Link>

            <Link href="/booking?service=event" data-testid="link-service-event">
              <Card className="package-card rounded-2xl p-8 hover-3d cursor-pointer group" data-testid="service-event">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-secondary to-accent rounded-full flex items-center justify-center mx-auto mb-6 group-hover:rotate-12 transition-transform duration-300">
                    <Camera className="text-white text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 font-serif">Event Photography</h3>
                  <p className="text-muted-foreground mb-6">
                    Professional coverage for corporate events, parties, and celebrations
                  </p>
                  <div className="text-sm text-muted-foreground">
                    Starting from <span className="text-2xl font-bold text-secondary">$150</span>/hour
                  </div>
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Portfolio Preview */}
      <section className="py-20 bg-background relative z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text" data-testid="portfolio-title">Featured Work</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A glimpse into our portfolio of captured memories
            </p>
          </div>

          <PortfolioGrid preview />

          <div className="text-center mt-12">
            <Link href="/portfolio" data-testid="link-view-portfolio">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-view-full-portfolio">
                <i className="fas fa-eye mr-2"></i>
                View Full Portfolio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Client Reviews Section */}
      <section className="py-20 bg-muted/50 relative z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text" data-testid="reviews-title">
              What Our Clients Say
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Real experiences from real clients who trusted us with their special moments
            </p>
          </div>

          <ReviewDisplay 
            type="general" 
            limit={3}
            showSubmitForm={true}
          />
        </div>
      </section>

      {/* Floating Book Now Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Link href="/booking" data-testid="link-floating-book">
          <Button 
            className="bg-gradient-to-r from-primary to-secondary text-white p-4 rounded-full shadow-2xl magnetic-btn animate-glow" 
            size="icon"
            data-testid="floating-book-button"
          >
            <i className="fas fa-calendar-plus text-xl"></i>
          </Button>
        </Link>
      </div>
    </div>
  );
}
