import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, GripVertical, Trash2, StarIcon, MessageSquareIcon, RefreshCwIcon, X, ZoomIn, Camera } from "lucide-react";
import { defaultCatalogues } from "@/data/photo-catalogues";
import { motion, AnimatePresence } from "framer-motion";

interface Catalogue {
  id: string;
  title: string;
  description: string;
  serviceType: string;
  coverImage: string;
  images: string[];
  createdAt: string;
  publishedAt: string;
  photographerName?: string | null;
  photographerId?: string | null;
}

interface Review {
  id: string;
  clientName: string;
  rating: number;
  reviewText: string;
  reviewType: string;
  createdAt: string;
}

interface PortfolioImage {
  id: string;
  src: string;
  alt: string;
  category: string;
  title: string;
  catalogueId?: string;
  imageIndex?: number;
}

interface PortfolioGridProps {
  preview?: boolean;
}

// Pattern-based card sizing for editorial grid
function getCardConfig(index: number) {
  const pattern = index % 7;
  const isWide = pattern === 0 || pattern === 4;
  const aspectClass =
    pattern === 0 ? 'aspect-video' :
    pattern === 1 ? 'aspect-[3/4]' :
    pattern === 2 ? 'aspect-square' :
    pattern === 3 ? 'aspect-[3/4]' :
    pattern === 4 ? 'aspect-video' :
    pattern === 5 ? 'aspect-[3/4]' :
    'aspect-square';
  return { isWide, aspectClass };
}

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  wedding: 'Weddings',
  photoshoot: 'Portraits',
  event: 'Events',
};

export default function PortfolioGrid({ preview = false }: PortfolioGridProps) {
  const [lightboxImage, setLightboxImage] = useState<PortfolioImage | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isEditMode, setIsEditMode] = useState(false);
  const [manageCatalogue, setManageCatalogue] = useState<Catalogue | null>(null);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [catalogueReviews, setCatalogueReviews] = useState<{ [key: string]: Review[] }>({});
  const [loadingReviews, setLoadingReviews] = useState<{ [key: string]: boolean }>({});

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const { data: catalogues, isLoading, isError } = useQuery<Catalogue[]>({
    queryKey: ["/api/catalogues"],
    retry: 2,
  });

  const fallbackCatalogues: Catalogue[] = defaultCatalogues.map((c) => ({
    ...c,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  }));

  const effectiveCatalogues = (!catalogues || catalogues.length === 0 || isError)
    ? fallbackCatalogues
    : catalogues;

  const getCatalogueImages = (cat: Catalogue) => [cat.coverImage, ...cat.images];

  // All images for lightbox navigation
  const allPortfolioImages: PortfolioImage[] = effectiveCatalogues.flatMap((cat) =>
    getCatalogueImages(cat).map((src, i) => ({
      id: `${cat.id}-${i}`,
      src,
      alt: `${cat.title} – Photo ${i + 1}`,
      category: cat.serviceType,
      title: cat.title,
      catalogueId: cat.id,
      imageIndex: i,
    }))
  );

  const fetchCatalogueReviews = async (catId: string) => {
    if (catalogueReviews[catId] || loadingReviews[catId]) return;
    setLoadingReviews(p => ({ ...p, [catId]: true }));
    try {
      const r = await fetch(`/api/reviews/catalogue/${catId}`);
      if (r.ok) { const data = await r.json(); setCatalogueReviews(p => ({ ...p, [catId]: data })); }
    } catch {}
    finally { setLoadingReviews(p => ({ ...p, [catId]: false })); }
  };

  const getCatalogueRating = (catId: string) => {
    const reviews = catalogueReviews[catId] || [];
    if (!reviews.length) return { average: 0, count: 0 };
    return { average: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length, count: reviews.length };
  };

  const displayCatalogues = preview ? effectiveCatalogues.slice(0, 6) : effectiveCatalogues;
  const filteredCatalogues = selectedCategory === 'all'
    ? displayCatalogues
    : displayCatalogues.filter(c => c.serviceType === selectedCategory);

  const filteredImages = allPortfolioImages.filter(img =>
    filteredCatalogues.some(c => c.id === img.catalogueId)
  );

  const openLightbox = (cat: Catalogue, imageIndex = 0) => {
    const img: PortfolioImage = {
      id: `${cat.id}-${imageIndex}`,
      src: getCatalogueImages(cat)[imageIndex],
      alt: `${cat.title} – Photo ${imageIndex + 1}`,
      category: cat.serviceType,
      title: cat.title,
      catalogueId: cat.id,
      imageIndex,
    };
    const idx = filteredImages.findIndex(i => i.id === img.id);
    setLightboxImage(img);
    setLightboxIndex(idx >= 0 ? idx : 0);
    if (cat.id) fetchCatalogueReviews(cat.id);
  };

  const navigateLightbox = (dir: 'prev' | 'next') => {
    const len = filteredImages.length;
    const next = dir === 'next' ? (lightboxIndex + 1) % len : (lightboxIndex - 1 + len) % len;
    setLightboxIndex(next);
    const img = filteredImages[next];
    setLightboxImage(img);
    if (img.catalogueId) fetchCatalogueReviews(img.catalogueId);
  };

  const updateCatalogueMutation = useMutation({
    mutationFn: async (payload: { id: string; coverImage: string; images: string[] }) => {
      await apiRequest(`/api/admin/catalogues/${payload.id}`, "PUT", {
        coverImage: payload.coverImage,
        images: payload.images,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catalogues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({ title: "Portfolio updated" });
      setManageCatalogue(null);
    },
    onError: () => toast({ title: "Failed to update portfolio", variant: "destructive" }),
  });

  const openManageDialog = (cat: Catalogue) => {
    setManageCatalogue(cat);
    setEditImages([cat.coverImage, ...(cat.images || [])]);
    setNewImageUrl("");
  };

  const handleDragStart = (i: number) => setDragIndex(i);
  const handleDrop = (i: number) => {
    if (dragIndex === null || dragIndex === i) return;
    const next = [...editImages];
    const [removed] = next.splice(dragIndex, 1);
    next.splice(i, 0, removed);
    setEditImages(next);
    setDragIndex(null);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {[...Array(6)].map((_, i) => {
          const { isWide, aspectClass } = getCardConfig(i);
          return (
            <div
              key={i}
              className={`rounded-2xl overflow-hidden bg-muted/50 shimmer-card ${isWide ? 'col-span-2' : 'col-span-1'} ${aspectClass}`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {/* Error banner */}
      {isError && (
        <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-3">
          <span className="flex-1">Showing sample portfolio — live data unavailable.</span>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/catalogues"] })} variant="outline" size="sm" className="gap-1.5 shrink-0" data-testid="button-retry-catalogues">
            <RefreshCwIcon className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}

      {/* Category filter + edit toggle */}
      {!preview && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex flex-wrap gap-2">
            {['all', 'wedding', 'photoshoot', 'event'].map(cat => (
              <motion.button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/25'
                    : 'bg-muted text-muted-foreground hover:bg-muted/60'
                }`}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                data-testid={`category-filter-${cat}`}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </motion.button>
            ))}
          </div>
          {isAdmin && (
            <Button
              variant={isEditMode ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setIsEditMode(p => !p)}
              data-testid="button-toggle-portfolio-edit"
            >
              {isEditMode ? 'Done Editing' : 'Edit Portfolio'}
            </Button>
          )}
        </div>
      )}

      {/* Editorial masonry grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCategory}
          className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {filteredCatalogues.map((cat, index) => {
            const { isWide, aspectClass } = getCardConfig(index);
            const coverImage = cat.coverImage;
            const imageCount = getCatalogueImages(cat).length;

            return (
              <motion.div
                key={cat.id}
                className={`relative overflow-hidden rounded-2xl group cursor-pointer ${isWide ? 'col-span-2' : 'col-span-1'} ${aspectClass}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                onHoverStart={() => setHoveredId(cat.id)}
                onHoverEnd={() => setHoveredId(null)}
                onClick={() => openLightbox(cat, 0)}
                data-testid={`portfolio-catalogue-${index}`}
              >
                {/* Image */}
                <motion.img
                  src={coverImage}
                  alt={cat.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  animate={{ scale: hoveredId === cat.id ? 1.07 : 1 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* Gradient overlay — always subtle at bottom, strong on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredId === cat.id ? 1 : 0 }}
                  transition={{ duration: 0.35 }}
                />

                {/* Hover content */}
                <motion.div
                  className="absolute inset-0 flex flex-col justify-end p-4 md:p-5"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: hoveredId === cat.id ? 1 : 0, y: hoveredId === cat.id ? 0 : 12 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="text-amber-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1 block">
                    {CATEGORY_LABELS[cat.serviceType] ?? cat.serviceType}
                  </span>
                  <h3 className="text-white font-bold text-[15px] md:text-base leading-tight line-clamp-2 mb-1">
                    {cat.title}
                  </h3>
                  {cat.photographerName && (
                    <p className="text-white/55 text-[12px]">📷 {cat.photographerName}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-white/40 text-[11px]">{imageCount} photo{imageCount !== 1 ? 's' : ''}</span>
                    <span className="w-1 h-1 rounded-full bg-white/25" />
                    <span className="text-white/40 text-[11px] flex items-center gap-1">
                      <ZoomIn className="w-3 h-3" /> View
                    </span>
                  </div>
                </motion.div>

                {/* Image count badge — always visible */}
                {imageCount > 1 && (
                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Camera className="w-2.5 h-2.5" />
                    {imageCount}
                  </div>
                )}

                {/* Admin edit button */}
                {isAdmin && isEditMode && (
                  <button
                    className="absolute bottom-3 left-3 z-10 px-3 py-1 bg-white/90 text-gray-900 text-[11px] font-semibold rounded-lg shadow hover:bg-white transition-colors"
                    onClick={(e) => { e.stopPropagation(); openManageDialog(cat); }}
                    data-testid={`button-manage-catalogue-${cat.id}`}
                  >
                    Manage Photos
                  </button>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Empty state */}
      {filteredCatalogues.length === 0 && !isLoading && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Camera className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Work Found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            {selectedCategory !== 'all'
              ? 'No images in this category yet — try selecting "All".'
              : 'No published galleries available yet.'}
          </p>
        </div>
      )}

      {/* ── Manage Images Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!manageCatalogue} onOpenChange={(open) => !open && setManageCatalogue(null)}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{manageCatalogue ? `Manage · ${manageCatalogue.title}` : 'Manage Catalogue'}</DialogTitle>
          </DialogHeader>
          {manageCatalogue && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Drag thumbnails to reorder. First image is the cover.</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {editImages.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(index)}
                    className={`relative group aspect-square rounded-xl overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${
                      dragIndex === index ? 'opacity-40 scale-95 border-primary' : 'border-border hover:border-amber-500/50'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
                    {index === 0 && (
                      <div className="absolute top-1 left-1 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">COVER</div>
                    )}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="w-4 h-4 text-white drop-shadow" />
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-end justify-center gap-1 pb-2 opacity-0 group-hover:opacity-100 transition-all">
                      {index !== 0 && (
                        <button
                          className="text-[9px] bg-white/90 text-gray-900 px-1.5 py-0.5 rounded font-medium shadow"
                          onClick={() => {
                            const next = [...editImages];
                            const [moved] = next.splice(index, 1);
                            next.unshift(moved);
                            setEditImages(next);
                          }}
                        >Set Cover</button>
                      )}
                      <button
                        className="p-1 bg-red-500/90 rounded-full shadow"
                        onClick={() => setEditImages(editImages.filter((_, idx) => idx !== index))}
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input placeholder="Add image URL" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} />
                <Button variant="outline" onClick={() => {
                  if (!newImageUrl.trim()) return;
                  setEditImages([...editImages, newImageUrl.trim()]);
                  setNewImageUrl('');
                }}>Add Image</Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setManageCatalogue(null)}>Close</Button>
                <Button
                  onClick={() => {
                    if (!manageCatalogue) return;
                    const cleaned = editImages.map(i => i.trim()).filter(Boolean);
                    if (!cleaned.length) { toast({ title: 'Add at least one image', variant: 'destructive' }); return; }
                    updateCatalogueMutation.mutate({ id: manageCatalogue.id, coverImage: cleaned[0], images: cleaned.slice(1) });
                  }}
                  disabled={updateCatalogueMutation.isPending}
                >
                  {updateCatalogueMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            className="fixed inset-0 z-[9990] bg-black/96 backdrop-blur-lg flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setLightboxImage(null)}
            data-testid="lightbox-modal"
          >
            {/* Close */}
            <button
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/8 hover:bg-white/15 text-white flex items-center justify-center transition-colors"
              onClick={() => setLightboxImage(null)}
              data-testid="lightbox-close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Prev */}
            {filteredImages.length > 1 && (
              <>
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/8 hover:bg-white/15 text-white flex items-center justify-center transition-all hover:scale-105"
                  onClick={(e) => { e.stopPropagation(); navigateLightbox('prev'); }}
                  data-testid="lightbox-prev"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/8 hover:bg-white/15 text-white flex items-center justify-center transition-all hover:scale-105"
                  onClick={(e) => { e.stopPropagation(); navigateLightbox('next'); }}
                  data-testid="lightbox-next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Content */}
            <div
              className="flex flex-col sm:flex-row w-full h-full max-w-6xl mx-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image */}
              <motion.div
                key={lightboxImage.id}
                className="flex-1 flex items-center justify-center p-6 sm:p-10 min-h-0"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <img
                  src={lightboxImage.src}
                  alt={lightboxImage.alt}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                  data-testid="lightbox-image"
                />
              </motion.div>

              {/* Sidebar */}
              {lightboxImage.catalogueId && (() => {
                const cat = effectiveCatalogues.find(c => c.id === lightboxImage.catalogueId);
                const reviews = catalogueReviews[lightboxImage.catalogueId] || [];
                const rating = getCatalogueRating(lightboxImage.catalogueId);
                if (!cat) return null;
                return (
                  <div className="sm:w-72 shrink-0 bg-white/[0.04] border-t sm:border-t-0 sm:border-l border-white/[0.08] p-5 overflow-y-auto flex flex-col gap-4">
                    <div>
                      <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">{CATEGORY_LABELS[cat.serviceType] ?? cat.serviceType}</span>
                      <h3 className="text-white font-bold text-lg mt-1 leading-tight" data-testid="lightbox-catalogue-title">{cat.title}</h3>
                      {cat.photographerName && (
                        <p className="text-amber-400/70 text-[13px] mt-1">📷 {cat.photographerName}</p>
                      )}
                      {cat.description && <p className="text-white/50 text-[13px] mt-2 leading-relaxed">{cat.description}</p>}
                    </div>

                    {rating.count > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <StarIcon key={i} className={`w-3.5 h-3.5 ${i < Math.round(rating.average) ? 'text-amber-400 fill-amber-400' : 'text-white/20'}`} />
                          ))}
                        </div>
                        <span className="text-white/50 text-[12px]">{rating.average.toFixed(1)} ({rating.count})</span>
                      </div>
                    )}

                    <div className="text-white/30 text-[11px]">
                      Photo {(lightboxImage.imageIndex ?? 0) + 1} of {getCatalogueImages(cat).length}
                      <span className="mx-2">·</span>
                      {lightboxIndex + 1} of {filteredImages.length} total
                    </div>

                    {reviews.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <MessageSquareIcon className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-white/60 text-[12px] font-semibold uppercase tracking-wider">Reviews</span>
                        </div>
                        <div className="space-y-3">
                          {reviews.slice(0, 3).map(r => (
                            <div key={r.id} className="bg-white/[0.05] rounded-xl p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-white font-semibold text-[13px]">{r.clientName}</span>
                                <div className="flex gap-0.5">
                                  {[...Array(r.rating)].map((_, i) => <StarIcon key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
                                </div>
                              </div>
                              <p className="text-white/60 text-[12px] leading-relaxed">{r.reviewText}</p>
                            </div>
                          ))}
                          {reviews.length > 3 && (
                            <p className="text-white/30 text-[11px] text-center">+{reviews.length - 3} more review{reviews.length - 3 !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Counter pill */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm text-white/60 text-[11px] font-semibold px-4 py-1.5 rounded-full">
              {lightboxIndex + 1} / {filteredImages.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
