import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useSiteConfig } from "@/context/site-config";
import { AdminSectionEdit } from "@/components/admin-section-edit";
import { AdminInlineEditor } from "@/components/admin-inline-editor";
import { motion } from "framer-motion";
import { ScrollReveal, StaggerReveal, RevealItem } from "@/components/scroll-reveal";
import { CountUp } from "@/components/count-up";
import { Camera, Star, Clock, ShieldCheck, Heart, Aperture, Sparkle, Trophy, Lightning } from "@phosphor-icons/react";

// Map Font Awesome icon class strings → Phosphor components
const FA_TO_PHOSPHOR: Record<string, React.ReactNode> = {
  "fas fa-camera":      <Camera size={22} weight="duotone" className="text-amber-400" />,
  "fas fa-star":        <Star size={22} weight="duotone" className="text-amber-400" />,
  "fas fa-clock":       <Clock size={22} weight="duotone" className="text-amber-400" />,
  "fas fa-shield-alt":  <ShieldCheck size={22} weight="duotone" className="text-amber-400" />,
  "fas fa-heart":       <Heart size={22} weight="duotone" className="text-amber-400" />,
  "fas fa-award":       <Trophy size={22} weight="duotone" className="text-amber-400" />,
  "fas fa-bolt":        <Lightning size={22} weight="duotone" className="text-amber-400" />,
  "fas fa-aperture":    <Aperture size={22} weight="duotone" className="text-amber-400" />,
};
const DEFAULT_HIGHLIGHT_ICON = <Sparkle size={22} weight="duotone" className="text-amber-400" />;

export default function About() {
  const { config } = useSiteConfig();
  const { about, layout } = config;
  const hiddenSections = new Set(layout.about.hiddenSections);
  const orderedSections = layout.about.sectionOrder.filter((section) => !hiddenSections.has(section));
  const [editorSection, setEditorSection] = useState<string | null>(null);

  // Parse numeric value from stat string (e.g. "500+" → 500)
  const parseStatValue = (val: string): number => {
    const num = parseInt(val.replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
  };
  const getStatSuffix = (val: string): string => {
    const match = val.match(/[^\d]+$/);
    return match ? match[0] : '';
  };

  const sections: Record<string, JSX.Element> = {
    about: (
      <div id="section-about-main" className="relative">
        <div className="absolute top-0 right-0 z-10">
          <AdminSectionEdit sectionId="site-about-main" label="Edit About" onEdit={(id) => setEditorSection(id)} />
        </div>

        {/* Ghost heading — decorative, strictly clipped, never overlaps content */}
        <div
          className="absolute top-0 left-0 w-full overflow-hidden h-36 select-none pointer-events-none"
          aria-hidden="true"
        >
          <span
            className="font-extrabold text-foreground/[0.03] leading-none block"
            style={{ fontSize: 'clamp(3.5rem, 10vw, 7rem)', fontFamily: 'var(--font-display, var(--font-serif))' }}
          >
            ABOUT
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 pt-16 pb-4">
          <ScrollReveal variant="fade-up" className="mb-3">
            <p className="eyebrow">Our Story</p>
          </ScrollReveal>
          <ScrollReveal variant="fade-up" delay={0.05} className="mb-12">
            <h1
              className="gradient-text font-extrabold leading-tight tracking-tight"
              style={{ fontFamily: 'var(--font-display, var(--font-serif))', fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
              data-testid="about-title"
            >
              {about.title}
            </h1>
          </ScrollReveal>

          {/* Stats row */}
          <ScrollReveal variant="fade-up" delay={0.1} className="mb-14">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border border-border rounded-2xl overflow-hidden">
              {about.stats.map((stat, index) => (
                <div
                  key={`${stat.label}-${index}`}
                  className={`flex flex-col items-center py-7 px-4 ${index < about.stats.length - 1 ? 'border-r border-border' : ''} ${index >= 2 ? 'border-t sm:border-t-0 border-border' : ''}`}
                  data-testid={`stat-${index}`}
                >
                  <span
                    className="text-amber-500 font-extrabold mb-1 counter-animation"
                    style={{ fontFamily: 'var(--font-display, var(--font-sans))', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}
                  >
                    <CountUp
                      to={parseStatValue(stat.value)}
                      suffix={getStatSuffix(stat.value)}
                    />
                  </span>
                  <span className="text-muted-foreground text-[12px] font-medium tracking-wide text-center">{stat.label}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>

          {/* Two-column story */}
          <div className="grid lg:grid-cols-2 gap-14 items-start">
            {/* Left — bold quote + paragraphs */}
            <ScrollReveal variant="slide-left" delay={0.1}>
              {about.paragraphs.length > 0 && (
                <blockquote
                  className="text-foreground font-bold text-xl md:text-2xl leading-snug mb-8 border-l-4 border-amber-500 pl-5"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  "{about.paragraphs[0]}"
                </blockquote>
              )}
              <div className="space-y-5">
                {about.paragraphs.slice(1).map((paragraph, index) => (
                  <p key={index} className="text-muted-foreground leading-relaxed text-[15px]">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/booking">
                  <Button
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-7 py-2.5 rounded-full text-[13px] shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                    data-testid="button-book-from-about"
                  >
                    Book Your Session
                  </Button>
                </Link>
                <Link href="/portfolio">
                  <Button
                    variant="outline"
                    className="border-border text-foreground hover:bg-muted px-7 py-2.5 rounded-full font-semibold text-[13px] transition-all active:scale-95"
                    data-testid="button-portfolio-from-about"
                  >
                    View Our Work
                  </Button>
                </Link>
              </div>
            </ScrollReveal>

            {/* Right — image */}
            <ScrollReveal variant="slide-right" delay={0.2}>
              <div className="relative">
                <div className="absolute -inset-3 rounded-2xl border border-amber-500/20 pointer-events-none" />
                <img
                  src={about.image}
                  alt="Featured photography session"
                  className="w-full rounded-2xl shadow-2xl object-cover"
                  style={{ maxHeight: '480px' }}
                  data-testid="photographer-image"
                />
                {/* Amber corner accent */}
                <div className="absolute -bottom-2 -right-2 w-16 h-16 rounded-br-2xl border-b-2 border-r-2 border-amber-500/50 pointer-events-none" />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    ),

    mission: (
      <div id="section-about-mission" className="mt-20 relative">
        <div className="absolute top-0 right-0 z-10">
          <AdminSectionEdit sectionId="site-about-mission" label="Edit Mission" onEdit={(id) => setEditorSection(id)} />
        </div>

        <ScrollReveal variant="fade-up">
          <p className="eyebrow mb-3">Our Purpose</p>
          <h2
            className="gradient-text font-extrabold mb-8 tracking-tight"
            style={{ fontFamily: 'var(--font-display, var(--font-serif))', fontSize: 'clamp(1.6rem, 4vw, 2.5rem)' }}
            data-testid="mission-title"
          >
            {about.mission.title}
          </h2>
        </ScrollReveal>

        <ScrollReveal variant="scale-in" delay={0.1}>
          <div className="relative rounded-2xl overflow-hidden">
            {/* Dark glass card with amber top border */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500" />
            <div className="bg-[#070709] p-8 md:p-12">
              <div
                className="absolute top-3 left-5 text-amber-500/15 font-serif pointer-events-none select-none"
                style={{ fontSize: '3.5rem', lineHeight: 1, fontFamily: 'Georgia, serif' }}
                aria-hidden="true"
              >
                "
              </div>
              <p
                className="text-white/80 text-lg md:text-xl leading-relaxed max-w-4xl mx-auto text-center relative z-10 italic"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {about.mission.body}
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    ),

    highlights: (
      <div id="section-about-highlights" className="mt-20 relative">
        <div className="absolute top-0 right-0 z-10">
          <AdminSectionEdit sectionId="site-about-highlights" label="Edit Highlights" onEdit={(id) => setEditorSection(id)} />
        </div>

        <ScrollReveal variant="fade-up" className="mb-10">
          <p className="eyebrow mb-3">Why Choose Us</p>
          <h2
            className="gradient-text font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-display, var(--font-serif))', fontSize: 'clamp(1.6rem, 4vw, 2.5rem)' }}
            data-testid="services-highlight-title"
          >
            {about.highlights.title}
          </h2>
        </ScrollReveal>

        <StaggerReveal className="grid md:grid-cols-3 gap-6">
          {about.highlights.items.map((item, index) => (
            <RevealItem key={`${item.title}-${index}`} variant="fade-up">
              <motion.div
                className="card-premium p-6 group"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                data-testid={`highlight-${index}`}
              >
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-amber-500/15 group-hover:border-amber-500/35 transition-all duration-300 group-hover:scale-110">
                  {FA_TO_PHOSPHOR[item.icon] ?? DEFAULT_HIGHLIGHT_ICON}
                </div>
                <h3 className="font-bold text-[17px] mb-2 text-foreground">{item.title}</h3>
                <p className="text-muted-foreground text-[14px] leading-relaxed">{item.description}</p>
              </motion.div>
            </RevealItem>
          ))}
        </StaggerReveal>
      </div>
    ),
  };

  return (
    <div className="pt-24 pb-24 relative z-10">
      <AdminInlineEditor
        open={!!editorSection}
        sectionId={editorSection}
        focusSection={editorSection}
        onOpenChange={(open) => { if (!open) setEditorSection(null); }}
      />
      <div className="max-w-6xl mx-auto px-4 overflow-hidden">
        {orderedSections.map((sectionKey) => (
          <div key={sectionKey}>{sections[sectionKey]}</div>
        ))}
      </div>
    </div>
  );
}
