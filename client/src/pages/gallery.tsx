import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Key, Eye, Heart, DownloadSimple, Check, Lock, CaretLeft, CaretRight, X, ChatDots, PaperPlaneTilt, ShareNetwork, Copy, ThumbsUp, ArrowUp, ArrowDown } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { useParams } from "wouter";
import { WatermarkOverlay } from "@/components/watermark-overlay";

const galleryAccessSchema = z.object({
  email: z.string().optional(),
  accessCode: z.string().optional(),
});
type GalleryAccessData = z.infer<typeof galleryAccessSchema>;

interface Gallery {
  id: string;
  bookingId: string;
  clientEmail: string;
  accessCode: string;
  galleryImages: string[];
  selectedImages: string[];
  finalImages: string[];
  status: string;
  galleryDownloadEnabled: boolean;
  selectedDownloadEnabled: boolean;
  finalDownloadEnabled: boolean;
  clientComment: string | null;
  imageComments: Record<string, string>;
  watermarkSettings?: Record<string, any>;
  requireAccessCode: boolean;
  requireEmail: boolean;
  shareEnabled: boolean;
  createdAt: Date;
  downloadUrls?: Record<string, string>;
}

interface GalleryInfo {
  id: string;
  requireAccessCode: boolean;
  requireEmail: boolean;
  shareEnabled: boolean;
}

// Serve a smaller Cloudinary thumbnail for the grid view (saves bandwidth on mobile)
function cloudinaryThumb(url: string, width = 400): string {
  if (!url.includes('res.cloudinary.com') || url.includes('/upload/c_') || url.includes('/upload/w_')) return url;
  return url.replace('/image/upload/', `/image/upload/c_fill,w_${width},q_auto,f_auto/`);
}

// For zip downloads: apply Cloudinary compression to keep files manageable.
// Full-resolution Cloudinary originals can be 10-20MB each — at 50 photos that's
// 500-1000MB of RAM inside JSZip, which crashes the mobile browser tab.
// w_2400,q_88,f_jpg reduces each to ~400-800KB while remaining print-quality.
function cloudinaryForDownload(url: string): string {
  if (!url.includes('res.cloudinary.com')) return url;
  if (url.includes('/upload/c_') || url.includes('/upload/w_') || url.includes('/upload/q_')) return url;
  return url.replace('/image/upload/', '/image/upload/w_2400,q_88,f_jpg/');
}

// Download a single image as a blob
async function downloadBlob(url: string, filename: string) {
  try {
    const res = await fetch(url.split('?')[0], { mode: 'cors' });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch {
    window.open(url, '_blank', 'noreferrer');
  }
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 5) return 'almost done';
  if (seconds < 60) return `${Math.ceil(seconds)}s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return s > 0 ? `${m}m ${s}s left` : `${m}m left`;
}

// Download one part (≤100 images) as a single ZIP.
// onPartProgress receives: (partPct 0-100, doneInPart, totalInPart)
async function downloadZipPart(
  images: string[],
  zipName: string,
  onPartProgress: (pct: number, done: number, total: number) => void
) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  let completed = 0;
  let failed = 0;
  const BATCH_SIZE = 8;

  for (let i = 0; i < images.length; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (url, batchIdx) => {
      const globalIdx = i + batchIdx;
      try {
        const fetchUrl = cloudinaryForDownload(url.split('?')[0]);
        const res = await fetch(fetchUrl, { mode: 'cors' });
        if (!res.ok) { failed++; return; }
        const blob = await res.blob();
        zip.file(`photo-${String(globalIdx + 1).padStart(3, '0')}.jpg`, blob);
      } catch { failed++; } finally {
        completed++;
        const pct = Math.round((completed / images.length) * 88);
        onPartProgress(pct, completed, images.length);
      }
    }));
  }

  onPartProgress(92, completed, images.length);
  await zip.generateAsync(
    { type: 'blob', compression: 'STORE' },
    (meta) => onPartProgress(92 + Math.round(meta.percent * 0.08), completed, images.length)
  ).then((blob) => {
    onPartProgress(100, completed, images.length);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  });
}

// Split large galleries into 100-image parts (mobile-safe, ~80MB each).
// Shows overall % of the ENTIRE gallery, global photo count, and time remaining.
async function downloadAllZip(
  images: string[],
  zipName: string,
  onProgress: (pct: number | null, label?: string) => void
) {
  const PART_SIZE = 100;
  const totalParts = Math.ceil(images.length / PART_SIZE);
  const totalImages = images.length;
  const baseName = zipName.replace('.zip', '');
  let globalDone = 0;
  const startTime = Date.now();

  onProgress(1, `0 / ${totalImages} photos`);

  for (let part = 0; part < totalParts; part++) {
    const partImages = images.slice(part * PART_SIZE, (part + 1) * PART_SIZE);
    const partName = totalParts > 1
      ? `${baseName}-part-${String(part + 1).padStart(2, '0')}-of-${totalParts}.zip`
      : zipName;
    const globalDoneAtPartStart = globalDone;

    await downloadZipPart(partImages, partName, (partPct, doneInPart) => {
      globalDone = globalDoneAtPartStart + doneInPart;

      // Overall percentage across all parts (fetch = 90%, zip build = 10%)
      const fetchPct = (globalDone / totalImages) * 90;
      const zipBuildOffset = partPct > 88 ? ((partPct - 88) / 12) * 10 * (partImages.length / totalImages) : 0;
      const overallPct = Math.min(99, Math.round(fetchPct + zipBuildOffset));

      // Time remaining estimate
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = globalDone / elapsed; // photos per second
      const remaining = rate > 0 ? (totalImages - globalDone) / rate : 0;
      const timeStr = globalDone > 4 && remaining > 0 ? ` · ${formatTimeRemaining(remaining)}` : '';

      const partLabel = totalParts > 1 ? ` (part ${part + 1}/${totalParts})` : '';
      onProgress(overallPct, `${globalDone} / ${totalImages} photos${partLabel}${timeStr}`);
    });

    if (part < totalParts - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  onProgress(100, `All ${totalImages} photos ready!`);
  setTimeout(() => onProgress(null), 4000);
}

export default function Gallery() {
  const params = useParams<{ email?: string; code?: string }>();
  // Parse ?gallery=ID from URL for shareable links
  const shareId = new URLSearchParams(window.location.search).get('gallery') || params.code && params.email ? null : null;
  const urlGalleryId = new URLSearchParams(window.location.search).get('gallery');

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [galleryInfo, setGalleryInfo] = useState<GalleryInfo | null>(null);
  const [visitorEmail, setVisitorEmail] = useState("");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedFinalImages, setSelectedFinalImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'gallery' | 'selected' | 'final'>('gallery');
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [commentSaved, setCommentSaved] = useState(false);
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  const [imageCommentDraft, setImageCommentDraft] = useState("");
  const [imageCommentSaving, setImageCommentSaving] = useState(false);
  const [likedImages, setLikedImages] = useState<string[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({});
  const [zipProgress, _setZipProgress] = useState<number | null>(null);
  const [zipLabel, setZipLabel] = useState('');
  const [hasSavedSelections, setHasSavedSelections] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Prevent accidental navigation while zip download is in progress
  useEffect(() => {
    if (zipProgress === null) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Download in progress — leaving will cancel it.';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [zipProgress]);

  const setZip = useCallback((pct: number | null, label = '') => {
    _setZipProgress(pct);
    setZipLabel(label);
  }, []);
  const { toast } = useToast();

  const form = useForm<GalleryAccessData>({
    resolver: zodResolver(galleryAccessSchema),
    defaultValues: {
      email: params.email ? decodeURIComponent(params.email) : "",
      accessCode: params.code || "",
    },
  });

  // Fetch gallery info for share links
  useEffect(() => {
    if (!urlGalleryId || gallery) return;
    apiRequest('GET', `/api/gallery/info/${urlGalleryId}`).then(r => r.ok ? r.json() : null).then(info => {
      if (info) setGalleryInfo(info);
    }).catch(() => {});
  }, [urlGalleryId]);

  const accessGalleryMutation = useMutation({
    mutationFn: async (data: GalleryAccessData) => {
      const body: any = { ...data };
      if (urlGalleryId) body.galleryId = urlGalleryId;
      const response = await apiRequest('POST', '/api/gallery/access', body);
      if (!response.ok) { const e = await response.json(); throw new Error(e.error); }
      return response.json();
    },
    onSuccess: (data: Gallery) => {
      setGallery(data);
      if (data.downloadUrls) setDownloadUrls(data.downloadUrls);
      // Load this visitor's own selections only — never show other visitors' picks
      const email = form.getValues('email') || '';
      const emailSels = (data.emailSelections as Record<string, string[]>) || {};
      // If email is known: use only their saved selection (empty if first visit)
      // If no email (anonymous share link): fall back to global selectedImages
      const savedSels = email ? (emailSels[email] || []) : (data.selectedImages || []);
      setSelectedImages(savedSels);
      setHasSavedSelections(savedSels.length > 0);
      setComment(data.clientComment || "");
      setImageComments(data.imageComments || {});
      setVisitorEmail(email);
      // Load likes
      apiRequest('GET', `/api/gallery/${data.id}/likes?email=${encodeURIComponent(email)}`).then(r => r.json()).then(d => {
        setLikedImages(d.likedByMe || []);
        setLikeCounts(d.counts || {});
      }).catch(() => {});
      toast({ title: "Gallery Accessed!", description: "Welcome to your photo gallery." });
    },
    onError: (e: any) => {
      toast({ title: "Access Failed", description: e.message || "Invalid email or access code.", variant: "destructive" });
    },
  });

  // Auto-submit for URL params (legacy /gallery/:email/:code) or no-credential share links
  useEffect(() => {
    if (autoSubmitted || gallery) return;
    if (params.email && params.code) {
      setAutoSubmitted(true);
      accessGalleryMutation.mutate({ email: decodeURIComponent(params.email), accessCode: params.code });
    } else if (urlGalleryId && galleryInfo && !galleryInfo.requireAccessCode && !galleryInfo.requireEmail) {
      setAutoSubmitted(true);
      accessGalleryMutation.mutate({});
    }
  }, [params.email, params.code, urlGalleryId, galleryInfo, autoSubmitted, gallery]);

  const toggleLike = async (imageUrl: string) => {
    if (!gallery || !visitorEmail) return;
    const res = await apiRequest('POST', `/api/gallery/${gallery.id}/like`, { email: visitorEmail, imageUrl });
    if (!res.ok) return;
    const { liked } = await res.json();
    setLikedImages(prev => liked ? [...prev, imageUrl] : prev.filter(u => u !== imageUrl));
    setLikeCounts(prev => ({ ...prev, [imageUrl]: (prev[imageUrl] || 0) + (liked ? 1 : -1) }));
  };

  const logDownload = (imageUrl: string, type: 'single' | 'bulk') => {
    if (!gallery) return;
    apiRequest('POST', `/api/gallery/${gallery.id}/log-download`, { email: visitorEmail || undefined, imageUrl, downloadType: type }).catch(() => {});
  };

  const shareLink = gallery ? `${window.location.origin}/gallery?gallery=${gallery.id}` : urlGalleryId ? `${window.location.origin}/gallery?gallery=${urlGalleryId}` : null;

  const copyShareLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const updateSelectionMutation = useMutation({
    mutationFn: async (images: string[]) => {
      if (!gallery) return;
      return apiRequest('PATCH', `/api/gallery/${gallery.id}/images`, { images, type: 'selected', email: visitorEmail || undefined });
    },
    onSuccess: () => {
      toast({ title: "Selection Updated!", description: "Your image selection has been saved." });
    },
    onError: () => {
      toast({ title: "Update Failed", description: "Failed to update your selection. Please try again.", variant: "destructive" });
    },
  });

  const saveCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!gallery) return;
      return apiRequest('PATCH', `/api/gallery/${gallery.id}/comment`, { comment: text });
    },
    onSuccess: () => {
      setCommentSaved(true);
      toast({ title: "Comment Saved!", description: "Your message has been sent to the photographer." });
    },
    onError: () => {
      toast({ title: "Failed to save comment", variant: "destructive" });
    },
  });

  const onSubmit = (data: GalleryAccessData) => {
    if (urlGalleryId && galleryInfo) {
      const needEmail = galleryInfo.requireEmail && !data.email;
      const needCode = galleryInfo.requireAccessCode && !data.accessCode;
      if (needEmail) { form.setError('email', { message: 'Email required' }); return; }
      if (needCode) { form.setError('accessCode', { message: 'Access code required' }); return; }
    }
    accessGalleryMutation.mutate(data);
  };

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev =>
      prev.includes(imageUrl) ? prev.filter(img => img !== imageUrl) : [...prev, imageUrl]
    );
  };

  const toggleFinalSelection = (imageUrl: string) => {
    setSelectedFinalImages(prev =>
      prev.includes(imageUrl) ? prev.filter(u => u !== imageUrl) : [...prev, imageUrl]
    );
  };

  const currentImages = viewMode === 'gallery'
    ? (gallery?.galleryImages || [])
    : viewMode === 'selected'
    ? selectedImages
    : gallery?.finalImages || [];

  const downloadEnabled =
    (viewMode === 'gallery' && gallery?.galleryDownloadEnabled) ||
    (viewMode === 'selected' && gallery?.selectedDownloadEnabled) ||
    (viewMode === 'final' && gallery?.finalDownloadEnabled);

  // Lightbox
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setImageCommentDraft(imageComments[currentImages[index]] || "");
  };
  const closeLightbox = () => setLightboxIndex(null);
  const prevImage = useCallback(() => {
    setLightboxIndex(prev => {
      if (prev === null) return null;
      const next = (prev - 1 + currentImages.length) % currentImages.length;
      setImageCommentDraft(imageComments[currentImages[next]] || "");
      return next;
    });
  }, [currentImages, imageComments]);
  const nextImage = useCallback(() => {
    setLightboxIndex(prev => {
      if (prev === null) return null;
      const next = (prev + 1) % currentImages.length;
      setImageCommentDraft(imageComments[currentImages[next]] || "");
      return next;
    });
  }, [currentImages, imageComments]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevImage();
      else if (e.key === 'ArrowRight') nextImage();
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, prevImage, nextImage]);

  const saveImageComment = async () => {
    if (!gallery || lightboxIndex === null) return;
    const imageUrl = currentImages[lightboxIndex];
    setImageCommentSaving(true);
    try {
      await apiRequest('PATCH', `/api/gallery/${gallery.id}/image-comment`, { imageUrl, comment: imageCommentDraft });
      setImageComments(prev => imageCommentDraft
        ? { ...prev, [imageUrl]: imageCommentDraft }
        : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== imageUrl))
      );
      toast({ title: "Note saved!" });
    } catch {
      toast({ title: "Failed to save note", variant: "destructive" });
    } finally {
      setImageCommentSaving(false);
    }
  };

  if (!gallery) {
    return (
      <div className="pt-20 pb-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text slide-in-up" data-testid="gallery-title">
              Client Gallery Access
            </h1>
            <p className="text-xl text-muted-foreground slide-in-up stagger-1">
              Access your photos and select favorites for editing
            </p>
          </div>
          <Card className="p-8 hover-3d slide-in-up stagger-2">
            <div className="max-w-md mx-auto">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="text-white text-2xl" />
                </div>
                <h3 className="text-xl font-semibold">Enter Gallery Access</h3>
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  {/* Email field — show always unless share link with requireEmail=false */}
                  {(!galleryInfo || galleryInfo.requireEmail) && (
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter your email" className="form-focus" data-testid="input-gallery-email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  {/* Access code — show always unless share link with requireAccessCode=false */}
                  {(!galleryInfo || galleryInfo.requireAccessCode) && (
                    <FormField control={form.control} name="accessCode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Code</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter access code" className="form-focus" data-testid="input-gallery-code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-semibold magnetic-btn" disabled={accessGalleryMutation.isPending} data-testid="button-access-gallery">
                    <Key className="mr-2 h-4 w-4" />
                    {accessGalleryMutation.isPending ? 'Accessing...' : 'Access Gallery'}
                  </Button>
                </form>
              </Form>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const lightboxImage = lightboxIndex !== null ? currentImages[lightboxIndex] : null;
  const isSelected = lightboxImage ? selectedImages.includes(lightboxImage) : false;

  return (
    <div className="pt-20 pb-20 relative z-10">
      {/* ── Lightbox ── */}
      {lightboxIndex !== null && lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center" onClick={closeLightbox}
          onTouchStart={(e) => { (e.currentTarget as any)._touchX = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const startX = (e.currentTarget as any)._touchX;
            if (startX == null) return;
            const diff = startX - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) { e.stopPropagation(); diff > 0 ? nextImage() : prevImage(); }
          }}
        >
          {/* Close */}
          <button className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10" onClick={closeLightbox}>
            <X className="w-6 h-6" />
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm z-10">
            {lightboxIndex + 1} / {currentImages.length}
          </div>

          {/* Prev */}
          {currentImages.length > 1 && (
            <button className="absolute left-4 top-[45%] -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); prevImage(); }}>
              <CaretLeft size={28} />
            </button>
          )}

          {/* Image */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxImage}
              alt={`Image ${lightboxIndex + 1}`}
              className="max-h-[72vh] max-w-[85vw] object-contain rounded-lg pointer-events-none select-none"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={{ WebkitUserDrag: 'none' as any, WebkitTouchCallout: 'none' as any }}
            />
            <WatermarkOverlay rawSettings={gallery?.watermarkSettings} category={viewMode} />
          </div>

          {/* Next */}
          {currentImages.length > 1 && (
            <button className="absolute right-4 top-[45%] -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}>
              <CaretRight size={28} />
            </button>
          )}

          {/* Bottom panel — actions + per-image comment */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-4 pt-3 pb-4" onClick={(e) => e.stopPropagation()}>
            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3 mb-3">
              {viewMode === 'gallery' && (
                <button
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-white/20 text-white hover:bg-white/30'}`}
                  onClick={() => toggleImageSelection(lightboxImage)}
                >
                  {isSelected ? <Check className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              )}
              {downloadEnabled && (
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/20 text-white hover:bg-white/30 transition-colors"
                  onClick={() => downloadBlob(lightboxImage, `photo-${lightboxIndex! + 1}.jpg`)}
                >
                  <DownloadSimple size={16} />
                  Download
                </button>
              )}
            </div>

            {/* Per-image comment */}
            <div className="max-w-2xl mx-auto flex gap-2">
              <input
                type="text"
                value={imageCommentDraft}
                onChange={(e) => setImageCommentDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveImageComment(); } }}
                placeholder={`Note about photo #${lightboxIndex + 1}… (press Enter to save)`}
                maxLength={500}
                className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/40"
              />
              <button
                onClick={saveImageComment}
                disabled={imageCommentSaving}
                className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <PaperPlaneTilt size={16} />
              </button>
            </div>
            {imageComments[lightboxImage] && imageCommentDraft === imageComments[lightboxImage] && (
              <p className="text-center text-white/50 text-xs mt-1">Note saved ✓</p>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text slide-in-up" data-testid="gallery-main-title">
            Your Photo Gallery
          </h1>
          <p className="text-xl text-muted-foreground slide-in-up stagger-1">
            Welcome back! Select your favorite images for professional editing.
          </p>
          {gallery?.shareEnabled && shareLink && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 text-sm text-muted-foreground max-w-sm overflow-hidden">
                <ShareNetwork size={16} className="shrink-0" />
                <span className="truncate">{shareLink}</span>
              </div>
              <Button size="sm" variant="outline" onClick={copyShareLink} className="shrink-0">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy link'}
              </Button>
            </div>
          )}
        </div>

        {/* View Mode Selector */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-card rounded-lg p-1 border">
            <Button variant={viewMode === 'gallery' ? 'default' : 'ghost'} className={`magnetic-btn ${viewMode === 'gallery' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setViewMode('gallery')} data-testid="button-view-gallery">
              <Eye className="mr-2 h-4 w-4" />
              All Photos ({gallery.galleryImages?.length || 0})
            </Button>
            <Button variant={viewMode === 'selected' ? 'default' : 'ghost'} className={`magnetic-btn ${viewMode === 'selected' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setViewMode('selected')} data-testid="button-view-selected">
              <Heart className="mr-2 h-4 w-4" />
              Selected ({selectedImages.length})
            </Button>
            {gallery.finalImages && gallery.finalImages.length > 0 && (
              <Button variant={viewMode === 'final' ? 'default' : 'ghost'} className={`magnetic-btn ${viewMode === 'final' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setViewMode('final')} data-testid="button-view-final">
                {gallery.finalDownloadEnabled ? <DownloadSimple size={16} className="mr-2" /> : <Lock size={16} className="mr-2" />}
                Final ({gallery.finalImages.length})
              </Button>
            )}
          </div>
        </div>

        {/* Saved-selections notice — appears when returning with a previous session */}
        {hasSavedSelections && viewMode === 'gallery' && (
          <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
            <span className="text-amber-700 dark:text-amber-400">
              <strong>{selectedImages.length} photos</strong> from your previous visit are pre-selected.
            </span>
            <button
              className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-400 underline underline-offset-2"
              onClick={() => { setSelectedImages([]); setHasSavedSelections(false); }}
            >
              Start Fresh
            </button>
          </div>
        )}

        {/* Download progress bar */}
        {zipProgress !== null && (
          <div className="flex flex-col items-center mb-6 gap-2">
            <div className="w-full max-w-sm bg-muted rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-400 h-3 rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${zipProgress}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-[13px] font-semibold text-foreground">
              <span className="tabular-nums text-amber-500">{zipProgress}%</span>
              <span className="text-muted-foreground font-normal">{zipLabel}</span>
            </div>
          </div>
        )}
        {viewMode === 'gallery' && currentImages.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {selectedImages.length > 0 && (
              <>
                <Button variant="outline" size="sm"
                  onClick={() => setSelectedImages([])}
                  className="border-red-500/30 text-red-500 hover:bg-red-500/10">
                  <X size={14} className="mr-1.5" />
                  Clear All ({selectedImages.length})
                </Button>
                {gallery.galleryDownloadEnabled && (
                  <Button variant="outline" size="sm" disabled={zipProgress !== null}
                    onClick={() => downloadAllZip(selectedImages, 'selected-photos.zip', setZip)}>
                    <DownloadSimple size={16} className="mr-2" />
                    {zipProgress !== null ? `${zipProgress}%` : `Download Selected (${selectedImages.length})`}
                  </Button>
                )}
              </>
            )}
            {gallery.galleryDownloadEnabled && (
              <Button variant="outline" size="sm" disabled={zipProgress !== null}
                onClick={() => downloadAllZip(gallery.galleryImages, 'all-photos.zip', setZip)}>
                <DownloadSimple size={16} className="mr-2" />
                {zipProgress !== null ? `${zipProgress}%` : 'Download All'}
              </Button>
            )}
          </div>
        )}
        {viewMode === 'selected' && gallery.selectedDownloadEnabled && currentImages.length > 0 && (
          <div className="flex justify-center mb-6">
            <Button variant="outline" size="sm" disabled={zipProgress !== null}
              onClick={() => downloadAllZip(selectedImages, 'selected-photos.zip', setZip)}>
              <DownloadSimple size={16} className="mr-2" />
              {zipProgress !== null ? `${zipProgress}%` : 'Download All Selected'}
            </Button>
          </div>
        )}
        {viewMode === 'final' && gallery.finalDownloadEnabled && currentImages.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {selectedFinalImages.length > 0 && (
              <Button size="sm" disabled={zipProgress !== null}
                onClick={() => downloadAllZip(selectedFinalImages, 'selected-finals.zip', setZip)}
                className="bg-gradient-to-r from-primary to-secondary text-white">
                <DownloadSimple size={16} className="mr-2" />
                {zipProgress !== null ? `${zipProgress}%` : `Download Selected (${selectedFinalImages.length})`}
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={zipProgress !== null}
              onClick={() => downloadAllZip(gallery.finalImages, 'final-photos.zip', setZip)}>
              <DownloadSimple size={16} className="mr-2" />
              {zipProgress !== null ? `${zipProgress}%` : `Download All (${currentImages.length})`}
            </Button>
          </div>
        )}

        {/* Gallery Status */}
        <div className="text-center mb-8">
          <Badge variant={gallery.status === 'completed' ? 'default' : 'secondary'} className="text-sm" data-testid="gallery-status">
            Status: {gallery.status.charAt(0).toUpperCase() + gallery.status.slice(1)}
          </Badge>
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {currentImages.map((imageUrl, index) => {
            const selected = selectedImages.includes(imageUrl);
            const isSelectedFinal = selectedFinalImages.includes(imageUrl);
            const hasNote = !!imageComments[imageUrl];
            return (
              <div
                key={`${imageUrl}-${index}`}
                className="relative aspect-square overflow-hidden rounded-xl hover-3d group cursor-pointer select-none"
                onClick={() => openLightbox(index)}
                onContextMenu={(e) => e.preventDefault()}
                data-testid={`gallery-image-${index}`}
              >
                <img
                  src={cloudinaryThumb(imageUrl, 400)}
                  alt={`Gallery image ${index + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 pointer-events-none"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{ WebkitUserDrag: 'none' as any, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' as any, userSelect: 'none' }}
                />
                <WatermarkOverlay rawSettings={gallery?.watermarkSettings} category={viewMode} />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none" />

                {/* Selection circle — gallery view */}
                {viewMode === 'gallery' && (
                  <button
                    className="absolute top-2 right-2 z-10 min-w-[44px] min-h-[44px] flex items-center justify-center -m-1"
                    onClick={(e) => { e.stopPropagation(); toggleImageSelection(imageUrl); }}
                    aria-label={selected ? "Deselect image" : "Select image"}
                  >
                    {selected ? (
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg ring-2 ring-white/50">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 border-2 border-white rounded-full bg-black/40 opacity-70 group-hover:opacity-100 transition-opacity duration-200 shadow-md" />
                    )}
                  </button>
                )}

                {/* Selection circle — final view */}
                {viewMode === 'final' && gallery.finalDownloadEnabled && (
                  <button
                    className="absolute top-2 right-2 z-10 min-w-[44px] min-h-[44px] flex items-center justify-center -m-1"
                    onClick={(e) => { e.stopPropagation(); toggleFinalSelection(imageUrl); }}
                    aria-label={isSelectedFinal ? "Deselect image" : "Select image"}
                  >
                    {isSelectedFinal ? (
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg ring-2 ring-white/50">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 border-2 border-white rounded-full bg-black/40 opacity-70 group-hover:opacity-100 transition-opacity duration-200 shadow-md" />
                    )}
                  </button>
                )}

                {/* Selected border — gallery view */}
                {viewMode === 'gallery' && selected && (
                  <div className="absolute inset-0 border-4 border-primary rounded-xl pointer-events-none" />
                )}

                {/* Selected border — final view */}
                {viewMode === 'final' && isSelectedFinal && (
                  <div className="absolute inset-0 border-4 border-primary rounded-xl pointer-events-none" />
                )}

                {/* Note indicator */}
                {hasNote && (
                  <div className="absolute top-2 left-2 p-1 bg-black/60 text-white rounded-full" title={imageComments[imageUrl]}>
                    <ChatDots size={12} />
                  </div>
                )}

                {/* Like button */}
                {visitorEmail && (
                  <button
                    className={`absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors opacity-0 group-hover:opacity-100 ${likedImages.includes(imageUrl) ? 'bg-pink-500 text-white' : 'bg-black/60 text-white hover:bg-pink-500/80'}`}
                    onClick={(e) => { e.stopPropagation(); toggleLike(imageUrl); }}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    {likeCounts[imageUrl] || ''}
                  </button>
                )}

                {/* Per-image download */}
                {downloadEnabled && (
                  <button
                    className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); logDownload(imageUrl, 'single'); downloadBlob(imageUrl, `photo-${index + 1}.jpg`); }}
                  >
                    <DownloadSimple size={14} />
                  </button>
                )}

                {/* Image counter — only show when no like button */}
                {!visitorEmail && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    #{index + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {currentImages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Images Available</h3>
            <p className="text-muted-foreground">
              {viewMode === 'selected'
                ? "You haven't selected any images yet. Go back to 'All Photos' to make your selection."
                : viewMode === 'final'
                ? "Your final edited images will appear here once processing is complete."
                : "No images have been uploaded to your gallery yet."}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {viewMode === 'gallery' && (
          <div className="text-center space-y-4">
            <div className="text-lg font-semibold text-muted-foreground mb-4">
              {selectedImages.length} images selected
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
              <Button onClick={() => updateSelectionMutation.mutate(selectedImages)} disabled={selectedImages.length === 0 || updateSelectionMutation.isPending} className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 rounded-lg font-semibold magnetic-btn animate-glow" data-testid="button-save-selection">
                <Heart className="mr-2 h-4 w-4" />
                {updateSelectionMutation.isPending ? 'Saving...' : 'Save Selection'}
              </Button>

              {selectedImages.length > 0 && (
                <Button variant="outline" onClick={() => setSelectedImages([])} className="px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-clear-selection">
                  Clear Selection
                </Button>
              )}

              {gallery.galleryDownloadEnabled && selectedImages.length > 0 && (
                <Button variant="outline" disabled={zipProgress !== null} onClick={() => downloadAllZip(selectedImages, 'selected-photos.zip', setZip)} className="px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-download-selected">
                  <DownloadSimple size={16} className="mr-2" />{zipProgress !== null ? `${zipProgress}%` : `Download Selected (${selectedImages.length})`}
                </Button>
              )}

              {gallery.galleryDownloadEnabled && currentImages.length > 0 && (
                <Button variant="outline" disabled={zipProgress !== null} onClick={() => downloadAllZip(gallery.galleryImages, 'all-photos.zip', setZip)} className="px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-download-all-gallery">
                  <DownloadSimple size={16} className="mr-2" />{zipProgress !== null ? `${zipProgress}%` : 'Download All'}
                </Button>
              )}
            </div>
          </div>
        )}

        {viewMode === 'selected' && gallery.selectedDownloadEnabled && currentImages.length > 0 && (
          <div className="text-center">
            <Button variant="outline" disabled={zipProgress !== null} onClick={() => downloadAllZip(selectedImages, 'selected-photos.zip', setZip)} className="px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-download-all-selected">
              <DownloadSimple size={16} className="mr-2" />{zipProgress !== null ? `${zipProgress}%` : 'Download All Selected'}
            </Button>
          </div>
        )}

        {viewMode === 'final' && gallery.finalDownloadEnabled && currentImages.length > 0 && (
          <div className="text-center space-y-4">
            <div className="text-lg font-semibold text-muted-foreground">
              {selectedFinalImages.length > 0 ? `${selectedFinalImages.length} selected` : `${currentImages.length} photos`}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
              {selectedFinalImages.length > 0 && (
                <Button disabled={zipProgress !== null} onClick={() => downloadAllZip(selectedFinalImages, 'selected-finals.zip', setZip)} className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 rounded-lg font-semibold magnetic-btn animate-glow" data-testid="button-download-selected-final">
                  <DownloadSimple size={16} className="mr-2" />{zipProgress !== null ? `${zipProgress}%` : `Download Selected (${selectedFinalImages.length})`}
                </Button>
              )}
              <Button variant="outline" disabled={zipProgress !== null} onClick={() => downloadAllZip(gallery.finalImages, 'final-photos.zip', setZip)} className="px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-download-all-final">
                <DownloadSimple size={16} className="mr-2" />{zipProgress !== null ? `${zipProgress}%` : `Download All (${currentImages.length})`}
              </Button>
              <Button
                variant="outline"
                className="px-8 py-3 rounded-lg font-semibold magnetic-btn"
                onClick={() => setSelectedFinalImages(
                  selectedFinalImages.length === currentImages.length ? [] : [...currentImages]
                )}
              >
                {selectedFinalImages.length === currentImages.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>
        )}

        {/* Overall Comment */}
        <Card className="mt-10 p-6 hover-3d">
          <div className="flex items-center gap-2 mb-4">
            <ChatDots size={20} className="text-primary" />
            <h4 className="text-lg font-semibold">Leave a Comment</h4>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Have any notes or requests for your photographer? Leave a general message here, or use the note field on individual photos when viewing them full size.
          </p>
          <Textarea
            value={comment}
            onChange={(e) => { setComment(e.target.value); setCommentSaved(false); }}
            placeholder="e.g. Please include the sunset photos, and I'd love warm tones on the editing..."
            className="min-h-[100px] mb-3"
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{comment.length}/2000</span>
            <Button onClick={() => saveCommentMutation.mutate(comment)} disabled={saveCommentMutation.isPending || commentSaved} className="magnetic-btn">
              {saveCommentMutation.isPending ? 'Saving...' : commentSaved ? '✓ Saved' : 'Save Comment'}
            </Button>
          </div>
        </Card>

        {/* Instructions */}
        <Card className="mt-6 p-6 bg-gradient-to-br from-primary/5 to-secondary/5 hover-3d">
          <h4 className="text-lg font-semibold mb-3" data-testid="instructions-title">Instructions</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Click any image to view it full size — navigate left/right with the arrows or keyboard</li>
            <li>• Use the circle in the top-right corner of a thumbnail to select/deselect, or tap Select inside the full-size view</li>
            <li>• Add a note to any individual photo using the text field at the bottom of the full-size view</li>
            <li>• Selected images will be professionally edited and retouched</li>
            <li>• View your selections in the "Selected" tab and final edits in the "Final" tab when ready</li>
            <li>• Don't forget to save your selection before leaving</li>
          </ul>
        </Card>
      </div>

      {/* Floating scroll buttons — appear only after scrolling down */}
      {scrollY > 300 && (
        <div className="fixed bottom-8 right-4 z-40 flex flex-col gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-11 h-11 rounded-full bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            aria-label="Scroll to top"
            title="Back to top"
          >
            <ArrowUp size={18} weight="bold" />
          </button>
          <button
            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
            className="w-11 h-11 rounded-full bg-card border border-border hover:border-amber-500/40 text-foreground shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            aria-label="Scroll to bottom"
            title="Jump to bottom"
          >
            <ArrowDown size={18} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
