import { useState, useEffect, useCallback, useRef } from "react";
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
import { Key, Eye, Heart, Download, Check, Lock, ChevronLeft, ChevronRight, X, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useParams } from "wouter";

const galleryAccessSchema = z.object({
  email: z.string().email("Valid email is required"),
  accessCode: z.string().min(1, "Access code is required"),
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
  createdAt: Date;
}

// Download a URL as a blob so it saves to device gallery rather than opening a new tab
async function downloadBlob(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // CORS fallback – open in new tab (user can long-press to save)
    window.open(url, '_blank', 'noreferrer');
  }
}

async function downloadAll(images: string[], prefix: string) {
  for (let i = 0; i < images.length; i++) {
    await new Promise<void>((resolve) => {
      setTimeout(async () => {
        await downloadBlob(images[i], `${prefix}-${i + 1}.jpg`);
        resolve();
      }, i * 300);
    });
  }
}

export default function Gallery() {
  const params = useParams<{ email?: string; code?: string }>();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'gallery' | 'selected' | 'final'>('gallery');
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [commentSaved, setCommentSaved] = useState(false);
  // Per-image comments (keyed by image URL)
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  const [imageCommentDraft, setImageCommentDraft] = useState("");
  const [imageCommentSaving, setImageCommentSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<GalleryAccessData>({
    resolver: zodResolver(galleryAccessSchema),
    defaultValues: {
      email: params.email ? decodeURIComponent(params.email) : "",
      accessCode: params.code || "",
    },
  });

  const accessGalleryMutation = useMutation({
    mutationFn: async (data: GalleryAccessData) => {
      const response = await apiRequest('POST', '/api/gallery/access', data);
      return response.json();
    },
    onSuccess: (data: Gallery) => {
      setGallery(data);
      setSelectedImages(data.selectedImages || []);
      setComment(data.clientComment || "");
      setImageComments(data.imageComments || {});
      toast({ title: "Gallery Accessed!", description: "Welcome to your photo gallery." });
    },
    onError: () => {
      toast({ title: "Access Failed", description: "Invalid email or access code. Please check your credentials.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (params.email && params.code && !autoSubmitted && !gallery) {
      setAutoSubmitted(true);
      accessGalleryMutation.mutate({ email: decodeURIComponent(params.email), accessCode: params.code });
    }
  }, [params.email, params.code, autoSubmitted, gallery]);

  const updateSelectionMutation = useMutation({
    mutationFn: async (images: string[]) => {
      if (!gallery) return;
      return apiRequest('PATCH', `/api/gallery/${gallery.id}/images`, { images, type: 'selected' });
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

  const onSubmit = (data: GalleryAccessData) => accessGalleryMutation.mutate(data);

  const toggleImageSelection = (imageUrl: string) => {
    setSelectedImages(prev =>
      prev.includes(imageUrl) ? prev.filter(img => img !== imageUrl) : [...prev, imageUrl]
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
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter your email" className="form-focus" data-testid="input-gallery-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="accessCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Access Code</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter access code" className="form-focus" data-testid="input-gallery-code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
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
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center" onClick={closeLightbox}>
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
              <ChevronLeft className="w-7 h-7" />
            </button>
          )}

          {/* Image */}
          <img
            src={lightboxImage}
            alt={`Image ${lightboxIndex + 1}`}
            className="max-h-[72vh] max-w-[85vw] object-contain rounded-lg pointer-events-none select-none"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
            style={{ WebkitUserDrag: 'none' as any, WebkitTouchCallout: 'none' as any }}
          />

          {/* Next */}
          {currentImages.length > 1 && (
            <button className="absolute right-4 top-[45%] -translate-y-1/2 text-white/80 hover:text-white p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); nextImage(); }}>
              <ChevronRight className="w-7 h-7" />
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
                  <Download className="w-4 h-4" />
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
                <Send className="w-4 h-4" />
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
                {gallery.finalDownloadEnabled ? <Download className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                Final ({gallery.finalImages.length})
              </Button>
            )}
          </div>
        </div>

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
                  src={imageUrl}
                  alt={`Gallery image ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 pointer-events-none"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{ WebkitUserDrag: 'none' as any, WebkitUserSelect: 'none', WebkitTouchCallout: 'none' as any, userSelect: 'none' }}
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 pointer-events-none" />

                {/* Selection circle */}
                {viewMode === 'gallery' && (
                  <button
                    className="absolute top-2 right-2 z-10"
                    onClick={(e) => { e.stopPropagation(); toggleImageSelection(imageUrl); }}
                    aria-label={selected ? "Deselect image" : "Select image"}
                  >
                    {selected ? (
                      <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 border-2 border-white rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md" />
                    )}
                  </button>
                )}

                {/* Selected border */}
                {viewMode === 'gallery' && selected && (
                  <div className="absolute inset-0 border-4 border-primary rounded-xl pointer-events-none" />
                )}

                {/* Note indicator */}
                {hasNote && (
                  <div className="absolute top-2 left-2 p-1 bg-black/60 text-white rounded-full" title={imageComments[imageUrl]}>
                    <MessageSquare className="w-3 h-3" />
                  </div>
                )}

                {/* Per-image download */}
                {downloadEnabled && (
                  <button
                    className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); downloadBlob(imageUrl, `photo-${index + 1}.jpg`); }}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Image counter */}
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  #{index + 1}
                </div>
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
                <Button variant="outline" onClick={() => downloadAll(selectedImages, 'selected')} className="px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-download-selected">
                  <Download className="mr-2 h-4 w-4" />
                  Download Selected ({selectedImages.length})
                </Button>
              )}

              {gallery.galleryDownloadEnabled && currentImages.length > 0 && (
                <Button variant="outline" onClick={() => downloadAll(currentImages, 'photo')} className="px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-download-all-gallery">
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              )}
            </div>
          </div>
        )}

        {viewMode === 'selected' && gallery.selectedDownloadEnabled && currentImages.length > 0 && (
          <div className="text-center">
            <Button variant="outline" onClick={() => downloadAll(currentImages, 'selected')} className="px-8 py-3 rounded-lg font-semibold magnetic-btn" data-testid="button-download-all-selected">
              <Download className="mr-2 h-4 w-4" />
              Download All Selected
            </Button>
          </div>
        )}

        {viewMode === 'final' && gallery.finalDownloadEnabled && currentImages.length > 0 && (
          <div className="text-center">
            <Button onClick={() => downloadAll(currentImages, 'final')} className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-3 rounded-lg font-semibold magnetic-btn animate-glow" data-testid="button-download-all-final">
              <Download className="mr-2 h-4 w-4" />
              Download All Final Photos
            </Button>
          </div>
        )}

        {/* Overall Comment */}
        <Card className="mt-10 p-6 hover-3d">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary" />
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
    </div>
  );
}
