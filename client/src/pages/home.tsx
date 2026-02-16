import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Heart, Users, ChevronDown } from "lucide-react";
import PortfolioGrid from "@/components/portfolio-grid";
import ReviewDisplay from "@/components/review-display";
import { useSiteConfig } from "@/context/site-config";
import { AdminSectionEdit } from "@/components/admin-section-edit";
import { AdminInlineEditor } from "@/components/admin-inline-editor";

export default function Home() {
  const { config } = useSiteConfig();
  const { home, layout } = config;
  const [editorSection, setEditorSection] = useState<string | null>(null);

  const hiddenSections = new Set(layout.home.hiddenSections);
  const orderedSections = layout.home.sectionOrder.filter((section) => !hiddenSections.has(section));

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const sections: Record<string, JSX.Element> = {
    hero: (
      <section id="section-home-hero" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute bottom-6 right-6 z-30">
          <AdminSectionEdit
            sectionId="site-home-hero"
            label="Edit Hero"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <div className="absolute inset-0 z-0">
          <img 
            src={home.hero.coverImage}
            alt={home.hero.subtitle}
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 hero-overlay"></div>
        </div>
        
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-7xl font-bold font-serif mb-6 slide-in-up" data-testid="hero-title">
            {home.hero.title}
            <span className="gradient-text typewriter block mt-2">{home.hero.highlight}</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 slide-in-up stagger-1 text-white/90" data-testid="hero-subtitle">
            {home.hero.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center slide-in-up stagger-2">
            <Link href={home.hero.primaryCtaHref} data-testid="link-book-session">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 rounded-lg font-semibold text-lg magnetic-btn animate-glow" data-testid="button-book-session">
                <i className="fas fa-calendar-plus mr-2"></i>
                {home.hero.primaryCtaLabel}
              </Button>
            </Link>
            <Link href={home.hero.secondaryCtaHref} data-testid="link-view-portfolio-hero">
              <Button variant="outline" className="border-2 border-primary bg-primary/10 text-primary hover:bg-primary hover:text-white px-8 py-4 rounded-lg font-semibold text-lg magnetic-btn" data-testid="button-view-portfolio">
                <i className="fas fa-images mr-2"></i>
                {home.hero.secondaryCtaLabel}
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
    ),
    services: (
      <section id="services" className="py-20 bg-muted relative z-10">
        <div className="absolute top-6 right-6">
          <AdminSectionEdit
            sectionId="site-home-services"
            label="Edit Services"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text" data-testid="services-title">
              {home.services.title}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {home.services.subtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {home.services.items.map((item, index) => (
              <Link key={`${item.title}-${index}`} href={item.href} data-testid={`link-service-${index}`}>
                <Card className="package-card rounded-2xl p-8 hover-3d cursor-pointer group" data-testid={`service-${index}`}>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-accent to-primary rounded-full flex items-center justify-center mx-auto mb-6 group-hover:rotate-12 transition-transform duration-300">
                      {index === 0 && <Users className="text-white text-2xl" />}
                      {index === 1 && <Heart className="text-white text-2xl" />}
                      {index === 2 && <Camera className="text-white text-2xl" />}
                      {index > 2 && <Camera className="text-white text-2xl" />}
                    </div>
                    <h3 className="text-2xl font-bold mb-4 font-serif">{item.title}</h3>
                    <p className="text-muted-foreground mb-6">{item.description}</p>
                    <div className="text-sm text-muted-foreground">
                      <span className="text-2xl font-bold text-accent">{item.priceLabel}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    ),
    portfolio: (
      <section id="section-home-portfolio" className="py-20 bg-background relative z-10">
        <div className="absolute top-6 right-6">
          <AdminSectionEdit
            sectionId="site-home-portfolio"
            label="Edit Portfolio"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text" data-testid="portfolio-title">
              {home.portfolio.title}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {home.portfolio.subtitle}
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
    ),
    reviews: (
      <section id="section-home-reviews" className="py-20 bg-muted/50 relative z-10">
        <div className="absolute top-6 right-6">
          <AdminSectionEdit
            sectionId="site-home-reviews"
            label="Edit Reviews"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text" data-testid="reviews-title">
              {home.reviews.title}
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {home.reviews.subtitle}
            </p>
          </div>

          <ReviewDisplay 
            type="general" 
            limit={3}
            showSubmitForm={true}
          />
        </div>
      </section>
    ),
  };

  return (
    <div className="relative z-10">
      <AdminInlineEditor
        open={!!editorSection}
        sectionId={editorSection}
        onOpenChange={(open) => {
          if (!open) setEditorSection(null);
        }}
      />
      {orderedSections.map((sectionKey) => (
        <div key={sectionKey}>{sections[sectionKey]}</div>
      ))}

      {!hiddenSections.has("floatingCta") && (
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
      )}
    </div>
  );
}
