export type WatermarkPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

const GRAVITY_MAP: Record<WatermarkPosition, string> = {
  'top-left':      'g_north_west,x_15,y_15',
  'top-center':    'g_north,y_15',
  'top-right':     'g_north_east,x_15,y_15',
  'middle-left':   'g_west,x_15',
  'center':        'g_center',
  'middle-right':  'g_east,x_15',
  'bottom-left':   'g_south_west,x_15,y_15',
  'bottom-center': 'g_south,y_15',
  'bottom-right':  'g_south_east,x_15,y_15',
};

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
  scale: number;         // 1–100 (% of image width)
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

/**
 * Insert a Cloudinary watermark transformation into a Cloudinary URL.
 */
export function applyWatermark(url: string, settings: WatermarkSettings): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;

  const opacity = Math.min(100, Math.max(0, Math.round(settings.opacity)));
  const scale = (Math.min(100, Math.max(1, settings.scale)) / 100).toFixed(2);
  const gravity = GRAVITY_MAP[settings.position ?? 'bottom-right'];

  let overlay = '';

  if (settings.type === 'text' && settings.text?.trim()) {
    const encoded = settings.text
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[\/\\,]/g, '');
    overlay = `l_text:Arial_40:${encoded},co_white,o_${opacity},${gravity},w_${scale},fl_relative,c_fit`;
  } else if (settings.type === 'image' && settings.imagePublicId?.trim()) {
    const encodedId = settings.imagePublicId.trim().replace(/\//g, ':');
    overlay = `l_${encodedId},o_${opacity},${gravity},w_${scale},fl_relative`;
  }

  if (!overlay) return url;

  return url.replace('/upload/', `/upload/${overlay}/`);
}

/**
 * Return the watermarked URL for a given gallery category.
 */
export function getWatermarkedUrl(
  url: string,
  category: 'gallery' | 'selected' | 'final',
  rawSettings: Record<string, any> | null | undefined,
): string {
  if (!rawSettings || typeof rawSettings !== 'object') return url;
  const settings = rawSettings as Partial<WatermarkSettings>;
  const enabled = settings.enabled ?? { gallery: false, selected: false, final: false };
  if (!enabled[category]) return url;
  return applyWatermark(url, { ...DEFAULT_WATERMARK_SETTINGS, ...settings } as WatermarkSettings);
}
