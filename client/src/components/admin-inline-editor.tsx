import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminSite } from "@/components/admin-site";

type AdminInlineEditorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId?: string | null;
};

export function AdminInlineEditor({ open, onOpenChange, sectionId }: AdminInlineEditorProps) {
  useEffect(() => {
    if (!open || !sectionId) return;
    window.location.hash = sectionId;
  }, [open, sectionId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Page Content</DialogTitle>
        </DialogHeader>
        <AdminSite />
      </DialogContent>
    </Dialog>
  );
}
