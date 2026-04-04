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
  if (!rawSettings || typeof rawSettings !== "object") return null;
  const s: WatermarkSettings = { ...DEFAULT_WATERMARK_SETTINGS, ...(rawSettings as Partial<WatermarkSettings>) };
  if (!preview && !s.enabled?.[category]) return null;

  // In preview mode show a placeholder so position/size is always visible
  const displayText = s.type === "text"
    ? (s.text?.trim() || (preview ? "© Your Studio Name" : ""))
    : "";
  if (s.type === "text" && !displayText) return null;
  if (s.type === "image" && !s.imageUrl?.trim()) return null;

  const effX = s.x ?? positionToXY(s.position ?? "bottom-right").x;
  const effY = s.y ?? positionToXY(s.position ?? "bottom-right").y;

  // Font size: scale% of the container's smaller dimension via CSS clamp.
  // We use a CSS custom property so the browser handles it without JS measurement.
  // cqmin = 1% of the smaller of the container's inline/block size.
  // Fallback: vmin (viewport-relative) is a reasonable substitute.
  const scale = s.scale ?? 5;
  const opacity = (s.opacity ?? 70) / 100;

  return (
    // No overflow-hidden here — parent containers (gallery card, lightbox)
    // already clip their contents. Removing it prevents text being cropped
    // when positioned near edges.
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ containerType: "size" } as React.CSSProperties}
    >
      <div
        style={{
          position: "absolute",
          left: `${effX}%`,
          top: `${effY}%`,
          transform: `translate(-${effX}%, -${effY}%)`,
          maxWidth: "90%",
        }}
      >
        {s.type === "text" ? (
          <span
            style={{
              // cqmin = 1% of the container's smaller dimension (width or height)
              fontSize: `${scale}cqmin`,
              color: "white",
              textShadow:
                "0 0 6px rgba(0,0,0,1), 0 0 12px rgba(0,0,0,0.9), 1px 1px 3px rgba(0,0,0,0.8)",
              opacity,
              fontFamily: "Arial, sans-serif",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              display: "block",
              lineHeight: 1.2,
            }}
          >
            {displayText}
          </span>
        ) : (
          <img
            src={s.imageUrl}
            alt="watermark"
            style={{
              width: `${scale}cqmin`,
              height: "auto",
              opacity,
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Live CSS preview (used in settings panel) ───────────────────────────────

interface WatermarkPreviewCanvasProps {
  settings: WatermarkSettings;
  sampleImageUrl?: string;
}

export function WatermarkPreviewCanvas({ settings, sampleImageUrl }: WatermarkPreviewCanvasProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-muted aspect-video relative bg-zinc-800">
      {sampleImageUrl ? (
        <img
          src={sampleImageUrl}
          alt="preview"
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
          No sample image
        </div>
      )}
      <WatermarkOverlay rawSettings={settings as any} category="gallery" preview />
    </div>
  );
}
