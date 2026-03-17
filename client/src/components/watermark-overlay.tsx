import { useCallback, useState } from "react";
import {
  type WatermarkSettings,
  DEFAULT_WATERMARK_SETTINGS,
  positionToXY,
} from "@/lib/cloudinary-watermark";

// ─── CSS overlay (used in gallery viewer) ────────────────────────────────────

interface WatermarkOverlayProps {
  /** Raw watermark settings from the gallery record (may be partial / undefined). */
  rawSettings: Record<string, any> | null | undefined;
  category: "gallery" | "selected" | "final";
  /** Skip the per-category enabled check (used in preview). */
  preview?: boolean;
}

export function WatermarkOverlay({ rawSettings, category, preview }: WatermarkOverlayProps) {
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Use a callback ref so the ResizeObserver is set up when the div
  // actually mounts — not necessarily on the component's first render
  // (which may return null while gallery data is loading).
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const measure = () => setContainerSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // No cleanup needed — element is being removed when this fires with null
  }, []);

  if (!rawSettings || typeof rawSettings !== "object") return null;
  const s: WatermarkSettings = { ...DEFAULT_WATERMARK_SETTINGS, ...(rawSettings as Partial<WatermarkSettings>) };
  if (!preview && !s.enabled?.[category]) return null;
  if (s.type === "text" && !s.text?.trim()) return null;
  if (s.type === "image" && !s.imageUrl?.trim()) return null;

  // Resolve x/y — fall back to legacy position if not set
  const effX = s.x ?? positionToXY(s.position ?? 'bottom-right').x;
  const effY = s.y ?? positionToXY(s.position ?? 'bottom-right').y;

  // Compute sizes from measured container.
  // scale is a direct percentage: scale=30 → 30% of container's min dimension (text)
  // or 30% of container width (image). Both use the same percentage concept.
  const cMin = Math.min(containerSize.w, containerSize.h);
  const cW = containerSize.w;
  const fontSize = cMin * (s.scale ?? 30) / 100;
  const imgWidth = cW * (s.scale ?? 30) / 100;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
    >
      <div style={{
        position: "absolute",
        left: `${effX}%`,
        top: `${effY}%`,
        transform: `translate(-${effX}%, -${effY}%)`,
      }}>
        {s.type === "text" ? (
          <span
            style={{
              fontSize: containerSize.w > 0 ? `${fontSize}px` : undefined,
              color: "white",
              textShadow: "0 0 4px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)",
              opacity: (s.opacity ?? 50) / 100,
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {s.text}
          </span>
        ) : (
          <img
            src={s.imageUrl}
            alt="watermark"
            style={{
              width: containerSize.w > 0 ? `${imgWidth}px` : `${s.scale ?? 30}%`,
              height: "auto",
              opacity: (s.opacity ?? 50) / 100,
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Live CSS preview (used in settings panel) ───────────────────────────────
// Uses the exact same WatermarkOverlay as the gallery — perfectly accurate.

interface WatermarkPreviewCanvasProps {
  settings: WatermarkSettings;
  sampleImageUrl?: string;
}

export function WatermarkPreviewCanvas({ settings, sampleImageUrl }: WatermarkPreviewCanvasProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-muted aspect-square relative bg-muted">
      {sampleImageUrl ? (
        <img
          src={sampleImageUrl}
          alt="preview"
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
          No sample image
        </div>
      )}
      <WatermarkOverlay rawSettings={settings as any} category="gallery" preview />
    </div>
  );
}
