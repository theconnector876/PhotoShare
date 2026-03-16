import { useEffect, useRef } from "react";
import {
  type WatermarkSettings,
  DEFAULT_WATERMARK_SETTINGS,
  getPositionStyle,
  getCanvasPosition,
} from "@/lib/cloudinary-watermark";

// ─── CSS overlay (used in gallery viewer) ────────────────────────────────────

interface WatermarkOverlayProps {
  /** Raw watermark settings from the gallery record (may be partial / undefined). */
  rawSettings: Record<string, any> | null | undefined;
  category: "gallery" | "selected" | "final";
}

export function WatermarkOverlay({ rawSettings, category }: WatermarkOverlayProps) {
  if (!rawSettings || typeof rawSettings !== "object") return null;
  const s: WatermarkSettings = { ...DEFAULT_WATERMARK_SETTINGS, ...(rawSettings as Partial<WatermarkSettings>) };
  if (!s.enabled?.[category]) return null;
  if (s.type === "text" && !s.text?.trim()) return null;
  if (s.type === "image" && !s.imageUrl?.trim()) return null;

  const posStyle = getPositionStyle(s.position ?? "bottom-right");

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      // container-type: size enables cqmin units for font-size
      style={{ containerType: "size" } as React.CSSProperties}
    >
      <div style={{ position: "absolute", ...posStyle }}>
        {s.type === "text" ? (
          <span
            style={{
              // scale 5–200: maps directly to cqmin units
              fontSize: `${(s.scale ?? 30) * 0.4}cqmin`,
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
              width: `${s.scale ?? 30}%`,
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

// ─── Canvas preview (used in settings panel) ─────────────────────────────────

interface WatermarkPreviewCanvasProps {
  settings: WatermarkSettings;
  sampleImageUrl?: string;
}

export function WatermarkPreviewCanvas({ settings, sampleImageUrl }: WatermarkPreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => drawPreview(), 80);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [settings, sampleImageUrl]);

  function drawPreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    const render = (bgReady: boolean, bgImg?: HTMLImageElement) => {
      ctx.clearRect(0, 0, cw, ch);

      // Background
      if (bgReady && bgImg) {
        ctx.drawImage(bgImg, 0, 0, cw, ch);
      } else {
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = "#444";
        ctx.font = "13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No sample image", cw / 2, ch / 2);
      }

      ctx.save();
      ctx.globalAlpha = (settings.opacity ?? 50) / 100;

      const fontSize = (settings.scale ?? 30) * 0.004 * Math.min(cw, ch);

      if (settings.type === "text" && settings.text?.trim()) {
        ctx.font = `bold ${fontSize}px Arial`;
        const metrics = ctx.measureText(settings.text);
        const wmW = metrics.width;
        const wmH = fontSize;
        const { x, y, textAlign, textBaseline } = getCanvasPosition(
          settings.position ?? "bottom-right", cw, ch, wmW, wmH,
        );
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        // Shadow for readability
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = "white";
        ctx.fillText(settings.text, x, y);
        ctx.shadowBlur = 0;
      } else if (settings.type === "image" && settings.imageUrl?.trim()) {
        const wmImg = new Image();
        wmImg.crossOrigin = "anonymous";
        wmImg.onload = () => {
          const wmW = cw * (settings.scale ?? 30) / 100;
          const wmH = wmImg.height * (wmW / wmImg.width);
          const { x, y } = getCanvasPosition(
            settings.position ?? "bottom-right", cw, ch, wmW, wmH,
          );
          // Adjust draw origin based on alignment
          const pos = settings.position ?? "bottom-right";
          const drawX = pos.includes("center") && !pos.includes("left") && !pos.includes("right")
            ? x - wmW / 2
            : pos.includes("right") ? x - wmW : x;
          const drawY = pos.includes("middle") || pos === "center"
            ? y - wmH / 2
            : pos.includes("bottom") ? y - wmH : y;
          ctx.drawImage(wmImg, drawX, drawY, wmW, wmH);
          ctx.restore();
        };
        wmImg.src = settings.imageUrl;
        // restore called inside onload
        return;
      }

      ctx.restore();
    };

    if (sampleImageUrl) {
      const bg = new Image();
      bg.crossOrigin = "anonymous";
      bg.onload = () => render(true, bg);
      bg.onerror = () => render(false);
      bg.src = sampleImageUrl;
    } else {
      render(false);
    }
  }

  return (
    <div className="rounded-lg overflow-hidden border border-muted">
      <canvas
        ref={canvasRef}
        width={320}
        height={200}
        className="w-full block"
        style={{ imageRendering: "auto" }}
      />
    </div>
  );
}
