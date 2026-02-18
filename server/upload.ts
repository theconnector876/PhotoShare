import { createHash } from "crypto";

// Returns Cloudinary credentials for signed browser-direct uploads.
// Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET env vars.
export function getCloudinarySignedConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

// Generates a Cloudinary upload signature.
// params should include at minimum { timestamp }.
export function generateSignature(
  params: Record<string, string | number>,
  apiSecret: string
): string {
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(paramString + apiSecret).digest("hex");
}

// Legacy: unsigned preset config (kept for reference, not actively used).
export function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || process.env.preset;
  if (!cloudName || !uploadPreset) return null;
  return { cloudName, uploadPreset };
}
