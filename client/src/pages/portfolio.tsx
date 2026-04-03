import { useState } from "react";
import PortfolioGrid from "@/components/portfolio-grid";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteConfig } from "@/context/site-config";
import { AdminSectionEdit } from "@/components/admin-section-edit";
import { AdminInlineEditor } from "@/components/admin-inline-editor";
import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/scroll-reveal";
import { ArrowRight } from "@phosphor-icons/react";

const CATEGORIES = ["All", "Weddings", "Portraits", "Events", "Fashion", "Commercial"];

export default function Portfolio() {
  const { config } = useSiteConfig();
  const { portfolio, layout } = config;
  const hiddenSections = new Set(layout.portfolio.hiddenSections);
  const orderedSections = layout.portfolio.sectionOrder.filter((section) => !hiddenSections.has(section));
  const [editorSection, setEditorSection] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const sections: Record<string, JSX.Element> = {
    portfolio: (
      <div id="section-portfolio-main" className="relative">
        <div className="absolute top-0 right-0 z-10">
          <AdminSectionEdit sectionId="site-portfolio-main" label="Edit Portfolio" onEdit={(id) => setEditorSection(id)} />
        </div>

        {/* Editorial header */}
        <div className="relative mb-14 overflow-hidden">
          {/* Ghost text */}
          <div
            className="absolute -bottom-4 left-0 select-none pointer-events-none overflow-hidden w-full"
            aria-hidden="true"
          >
            <span
              className="font-extrabold text-foreground/[0.035] leading-none block"
              style={{ fontSize: 'clamp(4rem, 15vw, 12rem)', fontFamily: 'var(--font-display, var(--font-serif))' }}
            >
              PORTFOLIO
            </span>
          </div>

          {/* Actual heading — left-aligned on desktop */}
          <ScrollReveal variant="fade-up" className="relative z-10 pb-2">
            <p className="eyebrow mb-3">Our Work</p>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div>
                <h1
                  className="font-extrabold leading-tight tracking-tight"
                  style={{
                    fontFamily: 'var(--font-display, var(--font-serif))',
                    fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                  }}
                  data-testid="portfolio-main-title"
                >
                  <span className="gradient-text">{portfolio.title}</span>
                </h1>
                <div className="section-divider mt-3 mb-4" />
                <p className="text-muted-foreground text-[15px] max-w-lg leading-relaxed">
                  {portfolio.subtitle}
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Category filter tabs */}
        <ScrollReveal variant="fade-up" delay={0.1} className="mb-8">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-[12px] font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/25'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal variant="fade-up" delay={0.15}>
          <PortfolioGrid />
        </ScrollReveal>
      </div>
    ),
    cta: (
      <div id="section-portfolio-cta" className="text-center mt-16 relative">
        <div className="absolute top-0 right-0 z-10">
          <AdminSectionEdit sectionId="site-portfolio-cta" label="Edit CTA" onEdit={(id) => setEditorSection(id)} />
        </div>

        <ScrollReveal variant="scale-in">
          {/* Decorative line */}
          <div className="flex items-center gap-4 mb-8 max-w-xs mx-auto">
            <div className="flex-1 h-px bg-border" />
            <span className="text-amber-500 text-lg">✦</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-muted-foreground text-[15px] mb-6 max-w-sm mx-auto">
            Ready to add your story to our portfolio?
          </p>

          <Link href={portfolio.ctaHref}>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-full text-[14px] shadow-lg shadow-amber-500/25 transition-all"
                data-testid="button-book-from-portfolio"
              >
                {portfolio.ctaLabel}
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </motion.div>
          </Link>
        </ScrollReveal>
      </div>
    ),
  };

  return (
    <div className="pt-24 pb-24 relative z-10 overflow-hidden">
      <AdminInlineEditor
        open={!!editorSection}
        sectionId={editorSection}
        focusSection={editorSection}
        onOpenChange={(open) => { if (!open) setEditorSection(null); }}
      />
      <div className="max-w-7xl mx-auto px-4">
        {orderedSections.map((sectionKey) => (
          <div key={sectionKey}>{sections[sectionKey]}</div>
        ))}
      </div>
    </div>
  );
}
