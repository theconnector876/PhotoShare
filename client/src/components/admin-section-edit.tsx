import { PencilSimple as Pencil } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

type AdminSectionEditProps = {
  sectionId: string;
  label: string;
  className?: string;
  onEdit?: (sectionId: string) => void;
};

export function AdminSectionEdit({ sectionId, label, className, onEdit }: AdminSectionEditProps) {
  const { isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  if (!isAdmin) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      className={`gap-2 shadow-md ${className ?? ""}`}
      data-testid={`button-edit-section-${sectionId}`}
      onClick={() => {
        if (onEdit) {
          onEdit(sectionId);
          return;
        }
        setLocation(`/admin?tab=site`);
        window.location.hash = sectionId;
      }}
    >
      <Pencil size={16} />
      {label}
    </Button>
  );
}
