import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminSite } from "@/components/admin-site";

const SECTION_LABELS: Record<string, string> = {
  "site-branding": "Branding",
  "site-theme": "Theme",
  "site-layout": "Layout",
  "site-home": "Home Page",
  "site-home-hero": "Hero Section",
  "site-home-services": "Services Section",
  "site-home-portfolio": "Portfolio Section",
  "site-home-reviews": "Reviews Section",
  "site-about": "About Page",
  "site-about-main": "About Content",
  "site-about-mission": "Mission Section",
  "site-about-highlights": "Highlights Section",
  "site-portfolio": "Portfolio Page",
  "site-portfolio-main": "Portfolio Heading",
  "site-portfolio-cta": "Portfolio CTA",
};

type AdminInlineEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId?: string | null;
  focusSection?: string | null;
};

export function AdminInlineEditor({ open, onOpenChange, sectionId, focusSection }: AdminInlineEditorProps) {
  useEffect(() => {
    if (!open || !sectionId) return;
    window.location.hash = sectionId;
  }, [open, sectionId]);

  const title = focusSection ? `Edit — ${SECTION_LABELS[focusSection] ?? focusSection}` : "Edit Page Content";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <AdminSite onlySection={focusSection} />
      </DialogContent>
    </Dialog>
  );
}
