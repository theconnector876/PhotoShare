import { useState } from "react";
import PortfolioGrid from "@/components/portfolio-grid";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteConfig } from "@/context/site-config";
import { AdminSectionEdit } from "@/components/admin-section-edit";
import { AdminInlineEditor } from "@/components/admin-inline-editor";

export default function Portfolio() {
  const { config } = useSiteConfig();
  const { portfolio, layout } = config;
  const hiddenSections = new Set(layout.portfolio.hiddenSections);
  const orderedSections = layout.portfolio.sectionOrder.filter((section) => !hiddenSections.has(section));
  const [editorSection, setEditorSection] = useState<string | null>(null);

  const sections: Record<string, JSX.Element> = {
    portfolio: (
      <div id="section-portfolio-main" className="relative">
        <div className="absolute top-0 right-0">
          <AdminSectionEdit
            sectionId="site-portfolio-main"
            label="Edit Portfolio"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold font-serif mb-4 gradient-text slide-in-up" data-testid="portfolio-main-title">
            {portfolio.title}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto slide-in-up stagger-1">
            {portfolio.subtitle}
          </p>
        </div>
        <PortfolioGrid />
      </div>
    ),
    cta: (
      <div id="section-portfolio-cta" className="text-center mt-16 relative">
        <div className="absolute top-0 right-0">
          <AdminSectionEdit
            sectionId="site-portfolio-cta"
            label="Edit CTA"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <Link href={portfolio.ctaHref}>
          <Button 
            className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-4 rounded-lg font-semibold text-lg magnetic-btn animate-glow"
            data-testid="button-book-from-portfolio"
          >
            <i className="fas fa-calendar-plus mr-2"></i>
            {portfolio.ctaLabel}
          </Button>
        </Link>
      </div>
    ),
  };

  return (
    <div className="pt-20 pb-20 relative z-10">
      <AdminInlineEditor
        open={!!editorSection}
        sectionId={editorSection}
        onOpenChange={(open) => {
          if (!open) setEditorSection(null);
        }}
      />
      <div className="max-w-7xl mx-auto px-4">
        {orderedSections.map((sectionKey) => (
          <div key={sectionKey}>{sections[sectionKey]}</div>
        ))}
      </div>
    </div>
  );
}
