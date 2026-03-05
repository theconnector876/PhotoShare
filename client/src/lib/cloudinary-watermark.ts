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
  scale: number;         // 5–80 (% of image width / cqmin font units)
  position: WatermarkPosition;
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: { gallery: false, selected: false, final: false },
  type: 'text',
  text: '',
  imageUrl: '',
  imagePublicId: '',
  opacity: 50,
  scale: 30,
  position: 'bottom-right',
};

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
