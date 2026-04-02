import { Link } from "wouter";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Calendar, Star } from "lucide-react";
import PortfolioGrid from "@/components/portfolio-grid";
import ReviewDisplay from "@/components/review-display";
import { useSiteConfig } from "@/context/site-config";
import { AdminSectionEdit } from "@/components/admin-section-edit";
import { AdminInlineEditor } from "@/components/admin-inline-editor";
import { useQuery } from "@tanstack/react-query";

/* ─── App Store–style category palette ──────────────────────── */
const SERVICE_GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-blue-400 to-indigo-500",
  "from-rose-400 to-pink-500",
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
];

/* Large emoji icons — rendered by OS/browser with natural depth */
const SERVICE_EMOJIS = ["📸", "💍", "🎉", "👨‍👩‍👧", "🎬"];

export default function Home() {
  const { config } = useSiteConfig();
  const { home, layout } = config;
  const [editorSection, setEditorSection] = useState<string | null>(null);

  const hiddenSections = new Set(layout.home.hiddenSections);
  const orderedSections = layout.home.sectionOrder.filter((s) => !hiddenSections.has(s));

  const { data: blogPreviews = [] } = useQuery<any[]>({
    queryKey: ["/api/blog", { page: 1, limit: 3 }],
    queryFn: async () => {
      const res = await fetch("/api/blog?page=1&limit=3", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // ── Section: Hero ──────────────────────────────────────────────────────────
  const heroSection = (
    <section id="section-home-hero" className="relative px-4 pt-4 pb-2 md:px-6">
      <div className="absolute top-7 right-7 z-20">
        <AdminSectionEdit sectionId="site-home-hero" label="Edit Hero" onEdit={setEditorSection} />
      </div>

      {/* Featured card — always dark (image overlay) */}
      <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 500 }}>
        <img
          src={home.hero.coverImage}
          alt={home.hero.subtitle}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

        <div className="relative z-10 flex flex-col justify-end h-full p-6 md:p-10" style={{ minHeight: 500 }}>
          <p className="text-amber-400 text-[11px] font-bold uppercase tracking-[0.2em] mb-2" data-testid="hero-eyebrow">
            Featured
          </p>
          <h1
            className="text-white text-4xl md:text-6xl font-black leading-[1.05] mb-3 tracking-tight"
            data-testid="hero-title"
          >
            {home.hero.title}
            {home.hero.highlight && (
              <span className="block text-amber-400 mt-1">{home.hero.highlight}</span>
            )}
          </h1>
          <p className="text-white/55 text-sm md:text-base mb-6 max-w-md leading-relaxed" data-testid="hero-subtitle">
            {home.hero.subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={home.hero.primaryCtaHref} data-testid="link-book-session">
              <Button
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-7 py-2.5 text-[13px] shadow-xl shadow-amber-500/25 transition-all active:scale-95"
                data-testid="button-book-session"
              >
                {home.hero.primaryCtaLabel}
              </Button>
            </Link>
            <Link href={home.hero.secondaryCtaHref} data-testid="link-view-portfolio-hero">
              <Button
                variant="outline"
                className="border-white/20 bg-white/8 text-white hover:bg-white/15 rounded-full px-7 py-2.5 text-[13px] backdrop-blur-sm transition-all active:scale-95"
                data-testid="button-view-portfolio"
              >
                {home.hero.secondaryCtaLabel}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );

  // ── Section: Services ──────────────────────────────────────────────────────
  const servicesSection = (
    <section id="services" className="px-4 py-6 md:px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="absolute top-6 right-6">
          <AdminSectionEdit sectionId="site-home-services" label="Edit Services" onEdit={setEditorSection} />
        </div>

        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-[22px] font-bold text-foreground tracking-tight" data-testid="services-title">
            {home.services.title}
          </h2>
          <Link href="/booking">
            <span className="text-[13px] text-muted-foreground hover:text-amber-500 transition-colors">See All →</span>
          </Link>
        </div>
        {home.services.subtitle && (
          <p className="text-muted-foreground text-[13px] mb-5">{home.services.subtitle}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {home.services.items.map((item, i) => {
            const gradient = SERVICE_GRADIENTS[i % SERVICE_GRADIENTS.length];
            const emoji = SERVICE_EMOJIS[i % SERVICE_EMOJIS.length];
            return (
              <Link key={`${item.title}-${i}`} href={item.href} data-testid={`link-service-${i}`}>
                <div
                  className={`category-card bg-gradient-to-br ${gradient} p-5`}
                  data-testid={`service-${i}`}
                >
                  {/* 3D emoji icon top-right */}
                  <div className="flex justify-end mb-2">
                    <span
                      className="text-5xl leading-none"
                      style={{
                        filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3)) drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                        display: 'inline-block',
                        transform: 'translateY(-4px) rotate(-6deg)',
                      }}
                      aria-hidden="true"
                    >
                      {emoji}
                    </span>
                  </div>
                  <div className="mt-auto">
                    <h3 className="text-white font-bold text-[15px] leading-tight mb-1 drop-shadow-sm">{item.title}</h3>
                    <p className="text-white/70 text-[11px] line-clamp-2 mb-2 leading-relaxed">{item.description}</p>
                    <span className="text-[12px] font-bold text-white/90 bg-black/20 rounded-full px-2 py-0.5">
                      {item.priceLabel}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );

  // ── Section: Portfolio ─────────────────────────────────────────────────────
  const portfolioSection = (
    <section id="section-home-portfolio" className="px-4 py-6 md:px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="absolute top-6 right-6">
          <AdminSectionEdit sectionId="site-home-portfolio" label="Edit Portfolio" onEdit={setEditorSection} />
        </div>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-[22px] font-bold text-foreground tracking-tight" data-testid="portfolio-title">
            {home.portfolio.title}
          </h2>
          <Link href="/portfolio">
            <span className="text-[13px] text-muted-foreground hover:text-amber-500 transition-colors">See All →</span>
          </Link>
        </div>
        {home.portfolio.subtitle && (
          <p className="text-muted-foreground text-[13px] -mt-3 mb-5">{home.portfolio.subtitle}</p>
        )}

        <PortfolioGrid preview />

        <div className="mt-6 flex justify-center">
          <Link href="/portfolio" data-testid="link-view-portfolio">
            <Button
              className="bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-full px-7 py-2.5 text-[13px] font-semibold border border-border transition-all active:scale-95"
              data-testid="button-view-full-portfolio"
            >
              View Full Portfolio
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );

  // ── Section: Reviews ──────────────────────────────────────────────────────
  const reviewsSection = (
    <section id="section-home-reviews" className="px-4 py-6 md:px-6 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="absolute top-6 right-6">
          <AdminSectionEdit sectionId="site-home-reviews" label="Edit Reviews" onEdit={setEditorSection} />
        </div>
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h2 className="text-[22px] font-bold text-foreground tracking-tight" data-testid="reviews-title">
              {home.reviews.title}
            </h2>
          </div>
        </div>
        {home.reviews.subtitle && (
          <p className="text-muted-foreground text-[13px] -mt-3 mb-5">{home.reviews.subtitle}</p>
        )}
        <ReviewDisplay type="general" limit={3} showSubmitForm={true} />
      </div>
    </section>
  );

  // ── Section: Blog ──────────────────────────────────────────────────────────
  const blogSection =
    blogPreviews.length > 0 ? (
      <section className="px-4 py-6 md:px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-baseline justify-between mb-5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-500" />
              <h2 className="text-[22px] font-bold text-foreground tracking-tight">From the Blog</h2>
            </div>
            <Link href="/blog">
              <span className="text-[13px] text-muted-foreground hover:text-amber-500 transition-colors">See All →</span>
            </Link>
          </div>

          <div className="space-y-3">
            {blogPreviews.map((post: any) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <div className="flex gap-4 p-4 rounded-2xl bg-card border border-border hover:border-amber-500/30 active:scale-[0.98] transition-all cursor-pointer shadow-sm">
                  {post.coverImage ? (
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-7 h-7 text-amber-400/60" />
                    </div>
                  )}
                  <div className="flex flex-col justify-center min-w-0">
                    <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </p>
                    <h3 className="text-foreground font-semibold text-[14px] leading-snug line-clamp-2 mb-1">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-muted-foreground text-[12px] line-clamp-1">{post.excerpt}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center self-center">
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <Link href="/blog">
              <Button
                variant="outline"
                className="rounded-full px-7 py-2.5 text-[13px] font-semibold border-border text-muted-foreground hover:text-foreground hover:border-border/80 bg-transparent transition-all active:scale-95"
              >
                View All Posts
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    ) : null;

  // ── Section map ───────────────────────────────────────────────────────────
  const sections: Record<string, JSX.Element | null> = {
    hero: heroSection,
    services: servicesSection,
    portfolio: portfolioSection,
    reviews: reviewsSection,
    blog: blogSection,
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
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          "@id": "https://www.connectagrapher.com/",
          name: appName,
          description: siteDesc,
          url: "https://www.connectagrapher.com/",
          telephone: "+1-876-000-0000",
          address: { "@type": "PostalAddress", addressCountry: "JM", addressRegion: "Kingston" },
          geo: { "@type": "GeoCoordinates", latitude: 17.9714, longitude: -76.7936 },
          priceRange: "$$",
          image: "https://www.connectagrapher.com/logo.png",
        })}</script>
      </Helmet>

      <AdminInlineEditor
        open={!!editorSection}
        sectionId={editorSection}
        focusSection={editorSection}
        onOpenChange={(open) => { if (!open) setEditorSection(null); }}
      />

      {/* Page wrapper — pt-14 to clear fixed nav */}
      <div className="relative z-10 pt-14 pb-8">
        {orderedSections.map((key) => {
          const el = sections[key];
          return el ? <div key={key}>{el}</div> : null;
        })}
      </div>

      {/* Floating Book CTA */}
      {!hiddenSections.has("floatingCta") && (
        <div className="fixed bottom-6 right-5 z-50">
          <Link href="/booking" data-testid="link-floating-book">
            <Button
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-5 py-3 shadow-2xl shadow-amber-500/30 text-[13px] active:scale-95 transition-all"
              data-testid="floating-book-button"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Now
            </Button>
          </Link>
        </div>
      )}
    </>
  );
}
