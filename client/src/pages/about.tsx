import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function About() {
  return (
    <div className="pt-20 pb-20 relative z-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <h1 className="text-4xl md:text-5xl font-bold font-serif mb-6 gradient-text slide-in-up" data-testid="about-title">
              About The Connector
            </h1>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed slide-in-up stagger-1">
              Based in the heart of Jamaica, The Connector Photography specializes in capturing life's most precious moments against the backdrop of our beautiful island. From intimate portrait sessions on pristine beaches to grand wedding celebrations in lush tropical settings.
            </p>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed slide-in-up stagger-2">
              With years of experience and a passion for storytelling through imagery, we bring creativity, professionalism, and the vibrant spirit of Jamaica to every session.
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6 slide-in-up stagger-3">
              <Card className="bg-card rounded-lg p-4 hover-3d" data-testid="stat-sessions">
                <div className="text-2xl font-bold text-primary mb-1">500+</div>
                <div className="text-sm text-muted-foreground">Sessions Completed</div>
              </Card>
              <Card className="bg-card rounded-lg p-4 hover-3d" data-testid="stat-weddings">
                <div className="text-2xl font-bold text-secondary mb-1">50+</div>
                <div className="text-sm text-muted-foreground">Weddings Captured</div>
              </Card>
              <Card className="bg-card rounded-lg p-4 hover-3d" data-testid="stat-rating">
                <div className="text-2xl font-bold text-accent mb-1">5★</div>
                <div className="text-sm text-muted-foreground">Client Rating</div>
              </Card>
              <Card className="bg-card rounded-lg p-4 hover-3d" data-testid="stat-parishes">
                <div className="text-2xl font-bold text-primary mb-1">14</div>
                <div className="text-sm text-muted-foreground">Parishes Covered</div>
              </Card>
            </div>

            <div className="mt-8 slide-in-up stagger-4">
              <Link href="/booking">
                <Button className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-4 rounded-lg font-semibold text-lg magnetic-btn animate-glow mr-4" data-testid="button-book-from-about">
                  <i className="fas fa-calendar-plus mr-2"></i>
                  Book Your Session
                </Button>
              </Link>
              <Link href="/portfolio">
                <Button variant="outline" className="px-8 py-4 rounded-lg font-semibold text-lg magnetic-btn" data-testid="button-portfolio-from-about">
                  <i className="fas fa-images mr-2"></i>
                  View Our Work
                </Button>
              </Link>
            </div>
          </div>

          <div className="order-1 lg:order-2 slide-in-up">
            <img 
              src="https://images.unsplash.com/photo-1502920917128-1aa500764cbd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=1000" 
              alt="Professional photographer with camera equipment" 
              className="w-full rounded-2xl shadow-2xl hover-3d" 
              data-testid="photographer-image"
            />
          </div>
        </div>

        {/* Mission Section */}
        <div className="mt-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-serif mb-8 gradient-text slide-in-up" data-testid="mission-title">
            Our Mission
          </h2>
          <Card className="p-8 bg-gradient-to-br from-primary/5 to-secondary/5 hover-3d slide-in-up stagger-1">
            <p className="text-lg text-muted-foreground leading-relaxed max-w-4xl mx-auto">
              To preserve your most cherished memories through the art of photography, celebrating the natural beauty of Jamaica while creating timeless images that tell your unique story. We believe every moment deserves to be captured with passion, creativity, and professional excellence.
            </p>
          </Card>
        </div>

        {/* Services Highlight */}
        <div className="mt-20">
          <h2 className="text-3xl md:text-4xl font-bold font-serif mb-12 gradient-text text-center slide-in-up" data-testid="services-highlight-title">
            What Sets Us Apart
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-6 hover-3d slide-in-up stagger-1" data-testid="highlight-local-expertise">
              <div className="w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-map-marked-alt text-white"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Local Expertise</h3>
              <p className="text-muted-foreground">
                Deep knowledge of Jamaica's most breathtaking locations and hidden gems for the perfect backdrop.
              </p>
            </Card>

            <Card className="p-6 hover-3d slide-in-up stagger-2" data-testid="highlight-professional-quality">
              <div className="w-12 h-12 bg-gradient-to-r from-secondary to-accent rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-award text-white"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Professional Quality</h3>
              <p className="text-muted-foreground">
                State-of-the-art equipment and advanced post-processing techniques ensure stunning results every time.
              </p>
            </Card>

            <Card className="p-6 hover-3d slide-in-up stagger-3" data-testid="highlight-personal-service">
              <div className="w-12 h-12 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-heart text-white"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Personal Service</h3>
              <p className="text-muted-foreground">
                Tailored approach to each client, ensuring your vision and personality shine through in every image.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
