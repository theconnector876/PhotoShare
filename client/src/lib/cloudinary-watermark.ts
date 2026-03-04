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
  opacity: number;  // 0–100
  scale: number;    // 1–100 (% of image width)
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: { gallery: false, selected: false, final: false },
  type: 'text',
  text: '',
  imageUrl: '',
  imagePublicId: '',
  opacity: 50,
  scale: 30,
};

/**
 * Insert a Cloudinary watermark transformation into a Cloudinary URL.
 * Works by inserting the transformation string right after `/upload/`.
 */
export function applyWatermark(url: string, settings: WatermarkSettings): string {
  if (!url || !url.includes('res.cloudinary.com')) return url;

  const opacity = Math.min(100, Math.max(0, Math.round(settings.opacity)));
  const scale = (Math.min(100, Math.max(1, settings.scale)) / 100).toFixed(2);

  let overlay = '';

  if (settings.type === 'text' && settings.text?.trim()) {
    // Encode text: spaces → _, remove chars that break URL paths
    const encoded = settings.text
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[\/\\,]/g, '');
    overlay = `l_text:Arial_40:${encoded},co_white,o_${opacity},g_south_east,x_15,y_15,w_${scale},fl_relative,c_fit`;
  } else if (settings.type === 'image' && settings.imagePublicId?.trim()) {
    // Forward slashes in public IDs must be encoded as colons for Cloudinary URL overlays
    const encodedId = settings.imagePublicId.trim().replace(/\//g, ':');
    overlay = `l_${encodedId},o_${opacity},g_south_east,x_15,y_15,w_${scale},fl_relative`;
  }

  if (!overlay) return url;

  return url.replace('/upload/', `/upload/${overlay}/`);
}

/**
 * Return the watermarked URL for a given gallery category.
 * If watermarking is disabled for that category (or settings are missing), returns the original URL.
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
