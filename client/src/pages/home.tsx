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
import { motion } from "framer-motion";
import { ScrollReveal, StaggerReveal, RevealItem } from "@/components/scroll-reveal";
import { CountUp } from "@/components/count-up";
import { MarqueeTicker } from "@/components/marquee-ticker";

/* ─── Service card palette ──────────────────────── */
const SERVICE_GRADIENTS = [
  "from-amber-500/90 to-orange-600/90",
  "from-blue-500/90 to-indigo-600/90",
  "from-rose-500/90 to-pink-600/90",
  "from-emerald-500/90 to-teal-600/90",
  "from-violet-500/90 to-purple-600/90",
];
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
    <section id="section-home-hero" className="relative min-h-[92vh] flex items-stretch overflow-hidden">
      <div className="absolute top-4 right-4 z-30">
        <AdminSectionEdit sectionId="site-home-hero" label="Edit Hero" onEdit={setEditorSection} />
      </div>

      {/* Split layout */}
      <div className="flex flex-col lg:flex-row w-full">
        {/* LEFT — dark editorial panel */}
        <div className="relative z-10 bg-[#070709] flex flex-col justify-center px-8 py-20 lg:px-14 lg:py-28 lg:w-[45%]">
          {/* Ambient glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)' }}
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-w-lg"
          >
            {/* Eyebrow */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="eyebrow mb-5 flex items-center gap-2"
              data-testid="hero-eyebrow"
            >
              <span className="text-amber-500">✦</span> Photography Studio
            </motion.p>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-white font-extrabold leading-[1.02] tracking-tight mb-4"
              style={{
                fontFamily: 'var(--font-display, var(--font-serif))',
                fontSize: 'clamp(2.4rem, 5vw, 4rem)',
              }}
              data-testid="hero-title"
            >
              {home.hero.title}
              {home.hero.highlight && (
                <span className="block text-gradient-gold mt-1">{home.hero.highlight}</span>
              )}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.7 }}
              className="text-white/50 text-[15px] leading-relaxed mb-8 max-w-md"
              data-testid="hero-subtitle"
            >
              {home.hero.subtitle}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="flex flex-wrap gap-3"
            >
              <Link href={home.hero.primaryCtaHref} data-testid="link-book-session">
                <Button
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-7 py-2.5 text-[13px] shadow-xl shadow-amber-500/30 transition-all hover:shadow-amber-500/50 hover:shadow-2xl active:scale-95"
                  data-testid="button-book-session"
                >
                  {home.hero.primaryCtaLabel}
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
              <Link href={home.hero.secondaryCtaHref} data-testid="link-view-portfolio-hero">
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/6 text-white hover:bg-white/12 rounded-full px-7 py-2.5 text-[13px] backdrop-blur-sm transition-all active:scale-95"
                  data-testid="button-view-portfolio"
                >
                  {home.hero.secondaryCtaLabel}
                </Button>
              </Link>
            </motion.div>

            {/* Floating stat badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="mt-10 inline-flex items-center gap-3 glass rounded-2xl px-4 py-3"
            >
              <div className="flex -space-x-1.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-[#070709] flex items-center justify-center text-[9px] font-bold text-black">
                    {['J', 'A', 'M'][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-white/50 text-[11px]">500+ happy clients</p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* RIGHT — image panel */}
        <div className="relative flex-1 min-h-[50vh] lg:min-h-0 overflow-hidden">
          {/* Golden frame accent */}
          <div className="absolute inset-0 z-10 pointer-events-none border-l-4 border-amber-500/30" />

          <motion.img
            src={home.hero.coverImage}
            alt={home.hero.subtitle}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.06 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#070709]/60 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070709]/40 via-transparent to-transparent" />
        </div>
      </div>
    </section>
  );

  // ── Section: Stats Bar ─────────────────────────────────────────────────────
  const statsBar = (
    <section className="bg-[#070709] border-y border-white/[0.06] py-8 px-4">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-0">
        {[
          { value: 500, suffix: '+', label: 'Sessions' },
          { value: 200, suffix: '+', label: 'Weddings' },
          { value: 4, suffix: '.9★', label: 'Rating' },
          { value: 5, suffix: ' Yrs', label: 'Experience' },
        ].map((stat, i) => (
          <div key={i} className={`flex flex-col items-center py-4 ${i < 3 ? 'md:border-r border-white/[0.06]' : ''}`}>
            <span
              className="text-amber-500 font-extrabold mb-1 counter-animation"
              style={{ fontFamily: 'var(--font-display, var(--font-sans))', fontSize: 'clamp(1.8rem, 4vw, 2.4rem)' }}
            >
              <CountUp to={stat.value} suffix={stat.suffix} />
            </span>
            <span className="text-white/35 text-[12px] font-medium tracking-wide uppercase">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  );

  // ── Section: Services ──────────────────────────────────────────────────────
  const servicesSection = (
    <section id="services" className="px-4 py-16 md:px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="absolute top-10 right-6 z-10">
          <AdminSectionEdit sectionId="site-home-services" label="Edit Services" onEdit={setEditorSection} />
        </div>

        <ScrollReveal variant="fade-up" className="mb-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">What We Offer</p>
              <h2
                className="font-extrabold text-foreground tracking-tight"
                style={{ fontFamily: 'var(--font-display, var(--font-sans))', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}
                data-testid="services-title"
              >
                {home.services.title}
              </h2>
            </div>
            <Link href="/booking">
              <span className="text-[13px] text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1 font-medium">
                See All <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
          {home.services.subtitle && (
            <p className="text-muted-foreground text-[14px] mt-2">{home.services.subtitle}</p>
          )}
        </ScrollReveal>

        <StaggerReveal className="grid grid-cols-2 gap-3 sm:gap-4">
          {home.services.items.map((item, i) => {
            const gradient = SERVICE_GRADIENTS[i % SERVICE_GRADIENTS.length];
            const emoji = SERVICE_EMOJIS[i % SERVICE_EMOJIS.length];
            return (
              <RevealItem key={`${item.title}-${i}`} variant="scale-in">
                <Link href={item.href} data-testid={`link-service-${i}`}>
                  <motion.div
                    className={`category-card bg-gradient-to-br ${gradient} p-5 relative overflow-hidden`}
                    whileHover={{ scale: 1.02, rotate: -0.5 }}
                    whileTap={{ scale: 0.97 }}
                    data-testid={`service-${i}`}
                  >
                    {/* Noise texture */}
                    <div
                      className="absolute inset-0 pointer-events-none opacity-10"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        backgroundSize: '200px 200px',
                      }}
                    />
                    {/* 3D emoji */}
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
                      <span className="text-[12px] font-bold text-white/90 bg-black/20 rounded-full px-2.5 py-0.5 backdrop-blur-sm">
                        {item.priceLabel}
                      </span>
                    </div>
                  </motion.div>
                </Link>
              </RevealItem>
            );
          })}
        </StaggerReveal>
      </div>
    </section>
  );

  // ── Section: Portfolio ─────────────────────────────────────────────────────
  const portfolioSection = (
    <section id="section-home-portfolio" className="px-4 py-16 md:px-6 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="absolute top-10 right-6 z-10">
          <AdminSectionEdit sectionId="site-home-portfolio" label="Edit Portfolio" onEdit={setEditorSection} />
        </div>

        <ScrollReveal variant="fade-up" className="mb-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">Featured Work</p>
              <h2
                className="font-extrabold text-foreground tracking-tight"
                style={{ fontFamily: 'var(--font-display, var(--font-sans))', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}
                data-testid="portfolio-title"
              >
                {home.portfolio.title}
              </h2>
            </div>
            <Link href="/portfolio">
              <span className="text-[13px] text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1 font-medium">
                See All <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
          {home.portfolio.subtitle && (
            <p className="text-muted-foreground text-[14px] mt-2">{home.portfolio.subtitle}</p>
          )}
        </ScrollReveal>

        <ScrollReveal variant="fade-up" delay={0.1}>
          <PortfolioGrid preview />
        </ScrollReveal>

        <div className="mt-8 flex justify-center">
          <Link href="/portfolio" data-testid="link-view-portfolio">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-full px-7 py-2.5 text-[13px] font-semibold border border-border transition-all"
                data-testid="button-view-full-portfolio"
              >
                View Full Portfolio
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>
    </section>
  );

  // ── Section: Reviews ──────────────────────────────────────────────────────
  const reviewsSection = (
    <section id="section-home-reviews" className="relative py-16 px-4 md:px-6 overflow-hidden">
      {/* Warm background tint */}
      <div className="absolute inset-0 bg-amber-500/[0.03] dark:bg-amber-500/[0.02] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/[0.015] to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="absolute top-0 right-0">
          <AdminSectionEdit sectionId="site-home-reviews" label="Edit Reviews" onEdit={setEditorSection} />
        </div>

        <ScrollReveal variant="fade-up" className="mb-8">
          <p className="eyebrow mb-2">Client Stories</p>
          <div className="flex items-center gap-2 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
            ))}
            <span className="text-muted-foreground text-[13px] ml-1">4.9 average</span>
          </div>
          <h2
            className="font-extrabold text-foreground tracking-tight"
            style={{ fontFamily: 'var(--font-display, var(--font-sans))', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}
            data-testid="reviews-title"
          >
            {home.reviews.title}
          </h2>
          {home.reviews.subtitle && (
            <p className="text-muted-foreground text-[14px] mt-1">{home.reviews.subtitle}</p>
          )}
        </ScrollReveal>

        <ScrollReveal variant="fade-up" delay={0.1}>
          <ReviewDisplay type="general" limit={3} showSubmitForm={true} />
        </ScrollReveal>
      </div>
    </section>
  );

  // ── Section: Blog ──────────────────────────────────────────────────────────
  const blogSection =
    blogPreviews.length > 0 ? (
      <section className="px-4 py-16 md:px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal variant="fade-up" className="mb-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="eyebrow mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-amber-500" /> Editorial
                </p>
                <h2
                  className="font-extrabold text-foreground tracking-tight"
                  style={{ fontFamily: 'var(--font-display, var(--font-sans))', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}
                >
                  From the Blog
                </h2>
              </div>
              <Link href="/blog">
                <span className="text-[13px] text-amber-500 hover:text-amber-400 transition-colors flex items-center gap-1 font-medium">
                  See All <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </div>
          </ScrollReveal>

          <StaggerReveal className="space-y-3">
            {blogPreviews.map((post: any) => (
              <RevealItem key={post.id} variant="fade-up">
                <Link href={`/blog/${post.slug}`}>
                  <motion.div
                    className="flex gap-4 p-4 rounded-2xl bg-card border border-border hover:border-amber-500/30 cursor-pointer shadow-sm"
                    whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                    transition={{ duration: 0.2 }}
                  >
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
                  </motion.div>
                </Link>
              </RevealItem>
            ))}
          </StaggerReveal>

          <div className="mt-6 flex justify-center">
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

      {/* Page wrapper — no pt since hero fills viewport edge-to-edge (nav is transparent on top) */}
      <div className="relative z-10">
        {/* Stats bar is always shown between hero and services */}
        {orderedSections.map((key) => {
          const el = sections[key];
          return el ? (
            <div key={key}>
              {el}
              {key === 'hero' && (
                <>
                  <MarqueeTicker />
                  {statsBar}
                </>
              )}
            </div>
          ) : null;
        })}
      </div>

      {/* Floating Book CTA */}
      {!hiddenSections.has("floatingCta") && (
        <motion.div
          className="fixed bottom-6 right-5 z-50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <Link href="/booking" data-testid="link-floating-book">
            <Button
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-5 py-3 shadow-2xl shadow-amber-500/35 text-[13px] transition-all hover:shadow-amber-500/50 hover:shadow-xl"
              data-testid="floating-book-button"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Now
            </Button>
          </Link>
        </motion.div>
      )}
    </>
  );
}
