import type { CSSProperties } from "react";

export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export const POSITION_GRID: WatermarkPosition[][] = [
  ['top-left',    'top-center',    'top-right'],
  ['middle-left', 'center',        'middle-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
];

export interface WatermarkSettings {
  enabled: {
    gallery: boolean;
    selected: boolean;
    final: boolean;
  };
  type: 'text' | 'image';
  text: string;
  imageUrl: string;
  imagePublicId: string;
  opacity: number;       // 0–100
  scale: number;         // 1–150 (cqmin units; >100 overscales beyond container, clipped at edge)
  position: WatermarkPosition; // kept for legacy / quick-select grid
  x: number;             // 0–100: horizontal anchor (0=left edge, 100=right edge)
  y: number;             // 0–100: vertical anchor (0=top edge, 100=bottom edge)
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: { gallery: false, selected: false, final: false },
  type: 'text',
  text: '',
  imageUrl: '',
  imagePublicId: '',
  opacity: 70,
  scale: 8,
  position: 'bottom-right',
  x: 100,
  y: 100,
};

/** Convert a legacy WatermarkPosition to x/y percentages. */
export function positionToXY(pos: WatermarkPosition): { x: number; y: number } {
  const map: Record<WatermarkPosition, { x: number; y: number }> = {
    'top-left':      { x: 0,   y: 0   },
    'top-center':    { x: 50,  y: 0   },
    'top-right':     { x: 100, y: 0   },
    'middle-left':   { x: 0,   y: 50  },
    'center':        { x: 50,  y: 50  },
    'middle-right':  { x: 100, y: 50  },
    'bottom-left':   { x: 0,   y: 100 },
    'bottom-center': { x: 50,  y: 100 },
    'bottom-right':  { x: 100, y: 100 },
  };
  return map[pos] ?? { x: 100, y: 100 };
}

/** Map a WatermarkPosition to CSS style for absolute positioning inside a relative container. */
export function getPositionStyle(position: WatermarkPosition): CSSProperties {
  const pad = 8;
  switch (position) {
    case 'top-left':      return { top: pad, left: pad };
    case 'top-center':    return { top: pad, left: '50%', transform: 'translateX(-50%)' };
    case 'top-right':     return { top: pad, right: pad };
    case 'middle-left':   return { top: '50%', left: pad, transform: 'translateY(-50%)' };
    case 'center':        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'middle-right':  return { top: '50%', right: pad, transform: 'translateY(-50%)' };
    case 'bottom-left':   return { bottom: pad, left: pad };
    case 'bottom-center': return { bottom: pad, left: '50%', transform: 'translateX(-50%)' };
    case 'bottom-right':  return { bottom: pad, right: pad };
  }
}

/**
 * Compute x, y, textAlign for drawing a watermark on a canvas.
 * Returns pixel coordinates for the watermark's anchor point and canvas textAlign.
 */
export function getCanvasPosition(
  position: WatermarkPosition,
  cw: number,
  ch: number,
  wmW: number,
  wmH: number,
  pad = 10,
): { x: number; y: number; textAlign: CanvasTextAlign; textBaseline: CanvasTextBaseline } {
  const mid = (a: number, b: number) => (a - b) / 2;
  switch (position) {
    case 'top-left':      return { x: pad,          y: pad,               textAlign: 'left',   textBaseline: 'top' };
    case 'top-center':    return { x: cw / 2,        y: pad,               textAlign: 'center', textBaseline: 'top' };
    case 'top-right':     return { x: cw - pad,      y: pad,               textAlign: 'right',  textBaseline: 'top' };
    case 'middle-left':   return { x: pad,          y: (ch - wmH) / 2,    textAlign: 'left',   textBaseline: 'middle' };
    case 'center':        return { x: cw / 2,        y: ch / 2,            textAlign: 'center', textBaseline: 'middle' };
    case 'middle-right':  return { x: cw - pad,      y: (ch - wmH) / 2,    textAlign: 'right',  textBaseline: 'middle' };
    case 'bottom-left':   return { x: pad,          y: ch - pad,          textAlign: 'left',   textBaseline: 'bottom' };
    case 'bottom-center': return { x: cw / 2,        y: ch - pad,          textAlign: 'center', textBaseline: 'bottom' };
    case 'bottom-right':  return { x: cw - pad,      y: ch - pad,          textAlign: 'right',  textBaseline: 'bottom' };
  }
}
