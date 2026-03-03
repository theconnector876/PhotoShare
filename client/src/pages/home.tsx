import { Link } from "wouter";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Heart, Users, ChevronDown, BookOpen, ArrowRight, Calendar } from "lucide-react";
import PortfolioGrid from "@/components/portfolio-grid";
import ReviewDisplay from "@/components/review-display";
import { useSiteConfig } from "@/context/site-config";
import { AdminSectionEdit } from "@/components/admin-section-edit";
import { AdminInlineEditor } from "@/components/admin-inline-editor";
import { useQuery } from "@tanstack/react-query";

export default function Home() {
  const { config } = useSiteConfig();
  const { home, layout } = config;
  const [editorSection, setEditorSection] = useState<string | null>(null);

  const hiddenSections = new Set(layout.home.hiddenSections);
  const orderedSections = layout.home.sectionOrder.filter((section) => !hiddenSections.has(section));

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const { data: blogPreviews = [] } = useQuery<any[]>({
    queryKey: ["/api/blog", { page: 1, limit: 3 }],
    queryFn: async () => {
      const res = await fetch("/api/blog?page=1&limit=3", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

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
    blog: blogPreviews.length > 0 ? (
      <section className="py-20 bg-muted/20 relative z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-3">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text">
              Latest from the Blog
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Photography tips, inspiration, and behind-the-scenes stories.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {blogPreviews.map((post: any) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer h-full">
                  {post.coverImage ? (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <BookOpen className="h-10 w-10 text-primary/30" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-bold text-base leading-snug mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.publishedAt || post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1 text-primary font-medium">
                        Read <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="text-center">
            <Link href="/blog">
              <Button variant="outline" className="gap-2 magnetic-btn">
                View All Posts
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    ) : <></>,
  };

  const appName = config.branding?.appName || "ConnectAGrapher";
  const siteDesc = `${appName} — Professional photography and videography services. Book your session for weddings, portraits, and events in Jamaica.`;

  return (
    <>
    <Helmet>
      <title>{appName} | Professional Photography & Videography</title>
      <meta name="description" content={siteDesc} />
      <link rel="canonical" href="https://www.connectagrapher.com/" />
      <meta property="og:title" content={`${appName} | Professional Photography`} />
      <meta property="og:description" content={siteDesc} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://www.connectagrapher.com/" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={`${appName} | Professional Photography`} />
      <meta name="twitter:description" content={siteDesc} />
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": "https://www.connectagrapher.com/",
        name: appName,
        description: siteDesc,
        url: "https://www.connectagrapher.com/",
        telephone: "+1-876-000-0000",
        address: {
          "@type": "PostalAddress",
          addressCountry: "JM",
          addressRegion: "Kingston",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 17.9714,
          longitude: -76.7936,
        },
        openingHoursSpecification: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
          opens: "08:00",
          closes: "20:00",
        },
        priceRange: "$$",
        image: "https://www.connectagrapher.com/logo.png",
        sameAs: [],
      })}</script>
    </Helmet>
    <div className="relative z-10">
      <AdminInlineEditor
        open={!!editorSection}
        sectionId={editorSection}
        focusSection={editorSection}
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
    </>
  );
}
