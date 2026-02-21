import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useSiteConfig } from "@/context/site-config";
import { AdminSectionEdit } from "@/components/admin-section-edit";
import { AdminInlineEditor } from "@/components/admin-inline-editor";

export default function About() {
  const { config } = useSiteConfig();
  const { about, layout } = config;
  const hiddenSections = new Set(layout.about.hiddenSections);
  const orderedSections = layout.about.sectionOrder.filter((section) => !hiddenSections.has(section));
  const [editorSection, setEditorSection] = useState<string | null>(null);

  const sections: Record<string, JSX.Element> = {
    about: (
      <div id="section-about-main" className="relative">
        <div className="absolute top-0 right-0">
          <AdminSectionEdit
            sectionId="site-about-main"
            label="Edit About"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1">
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-6 gradient-text slide-in-up" data-testid="about-title">
            {about.title}
          </h1>
          {about.paragraphs.map((paragraph, index) => (
            <p key={index} className="text-lg text-muted-foreground mb-6 leading-relaxed slide-in-up stagger-1">
              {paragraph}
            </p>
          ))}
          
          <div className="grid sm:grid-cols-2 gap-6 slide-in-up stagger-3">
            {about.stats.map((stat, index) => (
              <Card key={`${stat.label}-${index}`} className="bg-card rounded-lg p-4 hover-3d" data-testid={`stat-${index}`}>
                <div className="text-2xl font-bold text-primary mb-1">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </Card>
            ))}
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
            src={about.image}
            alt="Featured photography session" 
            className="w-full rounded-2xl shadow-2xl hover-3d" 
            data-testid="photographer-image"
          />
        </div>
        </div>
      </div>
    ),
    mission: (
      <div id="section-about-mission" className="mt-20 text-center relative">
        <div className="absolute top-0 right-0">
          <AdminSectionEdit
            sectionId="site-about-mission"
            label="Edit Mission"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold font-serif mb-8 gradient-text slide-in-up" data-testid="mission-title">
          {about.mission.title}
        </h2>
        <Card className="p-8 bg-gradient-to-br from-primary/5 to-secondary/5 hover-3d slide-in-up stagger-1">
          <p className="text-lg text-muted-foreground leading-relaxed max-w-4xl mx-auto">
            {about.mission.body}
          </p>
        </Card>
      </div>
    ),
    highlights: (
      <div id="section-about-highlights" className="mt-20 relative">
        <div className="absolute top-0 right-0">
          <AdminSectionEdit
            sectionId="site-about-highlights"
            label="Edit Highlights"
            onEdit={(id) => setEditorSection(id)}
          />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold font-serif mb-12 gradient-text text-center slide-in-up" data-testid="services-highlight-title">
          {about.highlights.title}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {about.highlights.items.map((item, index) => (
            <Card key={`${item.title}-${index}`} className="p-6 hover-3d slide-in-up stagger-1" data-testid={`highlight-${index}`}>
              <div className="w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mb-4">
                <i className={`${item.icon} text-white`}></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-muted-foreground">
                {item.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    ),
  };

  return (
    <div className="pt-20 pb-20 relative z-10">
      <AdminInlineEditor
        open={!!editorSection}
        sectionId={editorSection}
        focusSection={editorSection}
        onOpenChange={(open) => {
          if (!open) setEditorSection(null);
        }}
      />
      <div className="max-w-6xl mx-auto px-4">
        {orderedSections.map((sectionKey) => (
          <div key={sectionKey}>{sections[sectionKey]}</div>
        ))}
      </div>
    </div>
  );
}
