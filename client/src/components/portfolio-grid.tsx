import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, ChevronRight, GripVertical, Trash2, StarIcon, MessageSquareIcon, AlertCircleIcon, RefreshCwIcon, X } from "lucide-react";
import { defaultCatalogues } from "@/data/photo-catalogues";

interface Catalogue {
  id: string;
  title: string;
  description: string;
  serviceType: string;
  coverImage: string;
  images: string[];
  createdAt: string;
  publishedAt: string;
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

export default function PortfolioGrid({ preview = false }: PortfolioGridProps) {
  const [selectedImage, setSelectedImage] = useState<PortfolioImage | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [carouselIndexes, setCarouselIndexes] = useState<Record<string, number>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [manageCatalogue, setManageCatalogue] = useState<Catalogue | null>(null);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // Fetch published catalogues
  const { data: catalogues, isLoading, isError } = useQuery<Catalogue[]>({
    queryKey: ["/api/catalogues"],
    retry: 2,
  });

  // We'll fetch catalogue-specific reviews in the lightbox when needed
  const [catalogueReviews, setCatalogueReviews] = useState<{ [key: string]: Review[] }>({});
  const [loadingReviews, setLoadingReviews] = useState<{ [key: string]: boolean }>({});

  const fallbackCatalogues: Catalogue[] = defaultCatalogues.map((catalogue) => ({
    ...catalogue,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  }));

  const shouldUseFallback = !catalogues || catalogues.length === 0 || isError;
  const effectiveCatalogues = shouldUseFallback ? fallbackCatalogues : catalogues;

  const getCatalogueImages = (catalogue: Catalogue) => [catalogue.coverImage, ...catalogue.images];

  // Transform catalogues into portfolio images
  const portfolioImages: PortfolioImage[] = effectiveCatalogues.flatMap((catalogue) => {
    const allImages = getCatalogueImages(catalogue);
    return allImages.map((imageUrl, index) => ({
      id: `${catalogue.id}-${index}`,
      src: imageUrl,
      alt: `${catalogue.title} - Image ${index + 1}`,
      category: catalogue.serviceType,
      title: index === 0 ? catalogue.title : `${catalogue.title} - Image ${index + 1}`,
      catalogueId: catalogue.id,
      imageIndex: index
    }));
  });

  // Get catalogue details
  const getCurrentCatalogue = (catalogueId?: string): Catalogue | undefined => {
    if (!catalogueId) return undefined;
    return effectiveCatalogues.find(cat => cat.id === catalogueId);
  };

  // Fetch reviews for a specific catalogue
  const fetchCatalogueReviews = async (catalogueId: string) => {
    if (catalogueReviews[catalogueId] || loadingReviews[catalogueId]) return; // Already fetched or loading
    
    setLoadingReviews(prev => ({ ...prev, [catalogueId]: true }));
    
    try {
      const response = await fetch(`/api/reviews/catalogue/${catalogueId}`);
      if (response.ok) {
        const reviews = await response.json();
        setCatalogueReviews(prev => ({ ...prev, [catalogueId]: reviews }));
      }
    } catch (error) {
      console.error('Failed to fetch catalogue reviews:', error);
    } finally {
      setLoadingReviews(prev => ({ ...prev, [catalogueId]: false }));
    }
  };

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/catalogues"] });
  };

  // Calculate average rating for a catalogue
  const getCatalogueRating = (catalogueId: string): { average: number; count: number } => {
    const reviews = catalogueReviews[catalogueId] || [];
    if (reviews.length === 0) return { average: 0, count: 0 };
    
    const average = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    return { average, count: reviews.length };
  };

  const categories = ['all', 'wedding', 'photoshoot', 'event'];

  const displayCatalogues = preview
    ? effectiveCatalogues.slice(0, 6)
    : effectiveCatalogues;

  const filteredCatalogues = selectedCategory === 'all'
    ? displayCatalogues
    : displayCatalogues.filter(cat => cat.serviceType === selectedCategory);

  const displayCatalogueIds = new Set(displayCatalogues.map(cat => cat.id));
  const displayImages = portfolioImages.filter(img => img.catalogueId && displayCatalogueIds.has(img.catalogueId));
  const filteredImages = selectedCategory === 'all'
    ? displayImages
    : displayImages.filter(img => img.category === selectedCategory);

  const openLightbox = (image: PortfolioImage) => {
    setSelectedImage(image);
    
    // Fetch reviews for the catalogue if available
    if (image.catalogueId) {
      fetchCatalogueReviews(image.catalogueId);
    }
  };

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    
    const currentIndex = filteredImages.findIndex(img => img.id === selectedImage.id);
    let newIndex: number;
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : filteredImages.length - 1;
    } else {
      newIndex = currentIndex < filteredImages.length - 1 ? currentIndex + 1 : 0;
    }
    
    setSelectedImage(filteredImages[newIndex]);
  };

  const updateCarouselIndex = (catalogueId: string, nextIndex: number) => {
    setCarouselIndexes((prev) => ({ ...prev, [catalogueId]: nextIndex }));
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
    onError: () => {
      toast({ title: "Failed to update portfolio", variant: "destructive" });
    },
  });

  const openManageDialog = (catalogue: Catalogue) => {
    setManageCatalogue(catalogue);
    setEditImages([catalogue.coverImage, ...(catalogue.images || [])]);
    setNewImageUrl("");
  };

  const handleSaveImages = () => {
    if (!manageCatalogue) return;
    const cleaned = editImages.map((img) => img.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      toast({ title: "Add at least one image", variant: "destructive" });
      return;
    }
    updateCatalogueMutation.mutate({
      id: manageCatalogue.id,
      coverImage: cleaned[0],
      images: cleaned.slice(1),
    });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...editImages];
    const [removed] = next.splice(dragIndex, 1);
    next.splice(index, 0, removed);
    setEditImages(next);
    setDragIndex(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (isError) {
    // Fall back to local catalogues when API fails (e.g., missing DB env in production).
    // We'll show a small notice but keep the portfolio visible.
  }

  return (
    <div>
      {isError && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Showing fallback portfolio while the server data is unavailable.
          <Button
            onClick={handleRetry}
            variant="outline"
            size="sm"
            className="ml-3 gap-2"
            data-testid="button-retry-catalogues"
          >
            <RefreshCwIcon className="w-4 h-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Category Filter - Only show if not preview */}
      {!preview && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className={`magnetic-btn capitalize ${
                  selectedCategory === category ? 'bg-primary text-primary-foreground' : ''
                }`}
                onClick={() => setSelectedCategory(category)}
                data-testid={`category-filter-${category}`}
              >
                {category}
              </Button>
            ))}
          </div>
          {isAdmin && (
            <Button
              variant={isEditMode ? "default" : "outline"}
              className="gap-2"
              onClick={() => setIsEditMode((prev) => !prev)}
              data-testid="button-toggle-portfolio-edit"
            >
              {isEditMode ? "Editing Portfolio" : "Edit Portfolio"}
            </Button>
          )}
        </div>
      )}

      {/* Catalogue Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 ${preview ? 'mb-0' : 'mb-12'}`}>
        {filteredCatalogues.map((catalogue, index) => {
          const allImages = getCatalogueImages(catalogue);
          const currentIndex = carouselIndexes[catalogue.id] ?? 0;
          const currentImage = allImages[currentIndex];
          const imageTitle = currentIndex === 0 ? catalogue.title : `${catalogue.title} - Image ${currentIndex + 1}`;
          const imageForLightbox: PortfolioImage = {
            id: `${catalogue.id}-${currentIndex}`,
            src: currentImage,
            alt: `${catalogue.title} - Image ${currentIndex + 1}`,
            category: catalogue.serviceType,
            title: imageTitle,
            catalogueId: catalogue.id,
            imageIndex: currentIndex,
          };

          return (
            <Card
              key={catalogue.id}
              className="relative overflow-hidden rounded-xl hover-3d group transition-all duration-300"
              data-testid={`portfolio-catalogue-${index}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={currentImage}
                  alt={imageForLightbox.alt}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer"
                  loading="lazy"
                  onClick={() => openLightbox(imageForLightbox)}
                />
                {allImages.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
                      onClick={() => updateCarouselIndex(catalogue.id, (currentIndex - 1 + allImages.length) % allImages.length)}
                      data-testid={`carousel-prev-${catalogue.id}`}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white hover:bg-black/60"
                      onClick={() => updateCarouselIndex(catalogue.id, (currentIndex + 1) % allImages.length)}
                      data-testid={`carousel-next-${catalogue.id}`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {currentIndex + 1} / {allImages.length}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {catalogue.serviceType}
                  </Badge>
                </div>
                <div className="text-lg font-semibold">{catalogue.title}</div>
                {catalogue.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {catalogue.description}
                  </div>
                )}
                {isAdmin && isEditMode && (
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openManageDialog(catalogue)}
                      data-testid={`button-manage-catalogue-${catalogue.id}`}
                    >
                      Manage Photos
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!manageCatalogue} onOpenChange={(open) => !open && setManageCatalogue(null)}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {manageCatalogue ? `Manage ${manageCatalogue.title}` : "Manage Catalogue"}
            </DialogTitle>
          </DialogHeader>
          {manageCatalogue && (
            <div className="space-y-4">
              <div className="space-y-3">
                {editImages.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="flex items-center gap-3 border rounded-lg p-3 bg-background"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(index)}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Input
                        value={url}
                        onChange={(event) => {
                          const next = [...editImages];
                          next[index] = event.target.value;
                          setEditImages(next);
                        }}
                      />
                      {index === 0 && (
                        <div className="text-xs text-muted-foreground mt-1">Cover image</div>
                      )}
                    </div>
                    {index !== 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const next = [...editImages];
                          const [moved] = next.splice(index, 1);
                          next.unshift(moved);
                          setEditImages(next);
                        }}
                      >
                        Set Cover
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        const next = editImages.filter((_, idx) => idx !== index);
                        setEditImages(next);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Add image URL"
                  value={newImageUrl}
                  onChange={(event) => setNewImageUrl(event.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!newImageUrl.trim()) return;
                    setEditImages([...editImages, newImageUrl.trim()]);
                    setNewImageUrl("");
                  }}
                >
                  Add Image
                </Button>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setManageCatalogue(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={handleSaveImages}
                  disabled={updateCatalogueMutation.isPending}
                >
                  {updateCatalogueMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Empty State */}
      {filteredCatalogues.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-images text-muted-foreground text-2xl"></i>
          </div>
          <h3 className="text-xl font-semibold mb-2">No Images Found</h3>
          <p className="text-muted-foreground">
            {catalogues?.length === 0 
              ? "No published catalogues available yet. Check back soon for our latest work!"
              : "No images available for the selected category. Try selecting a different category."
            }
          </p>
        </div>
      )}

      {/* Lightbox Modal */}
      <Dialog open={!!selectedImage} onOpenChange={closeLightbox}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black/95 border-none" data-testid="lightbox-modal">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={closeLightbox}
              data-testid="lightbox-close"
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Navigation Buttons */}
            {filteredImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 z-10 text-white hover:bg-white/20 magnetic-btn"
                  onClick={() => navigateImage('prev')}
                  data-testid="lightbox-prev"
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 z-10 text-white hover:bg-white/20 magnetic-btn"
                  onClick={() => navigateImage('next')}
                  data-testid="lightbox-next"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Main Image */}
            {selectedImage && (
              <div className="w-full h-full flex items-center justify-center">
                {/* Left Panel - Image */}
                <div className="flex-1 h-full flex items-center justify-center p-8">
                  <img
                    src={selectedImage.src}
                    alt={selectedImage.alt}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    data-testid="lightbox-image"
                  />
                </div>

                {/* Right Panel - Details */}
                {selectedImage.catalogueId && (
                  <div className="w-80 h-full bg-black/60 backdrop-blur-sm p-6 overflow-y-auto">
                    {(() => {
                      const catalogue = getCurrentCatalogue(selectedImage.catalogueId);
                      const reviews = catalogueReviews[selectedImage.catalogueId] || [];
                      const rating = getCatalogueRating(selectedImage.catalogueId);
                      
                      return catalogue ? (
                        <div className="text-white">
                          {/* Catalogue Header */}
                          <div className="mb-6">
                            <Badge variant="secondary" className="mb-3">
                              {catalogue.serviceType}
                            </Badge>
                            <h3 className="text-xl font-semibold mb-2" data-testid="lightbox-catalogue-title">
                              {catalogue.title}
                            </h3>
                            <p className="text-sm text-white/80 mb-3">
                              {catalogue.description}
                            </p>
                            
                            {/* Rating */}
                            {loadingReviews[selectedImage.catalogueId] ? (
                              <div className="flex items-center gap-2 mb-3">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/40"></div>
                                <span className="text-sm text-white/60">Loading reviews...</span>
                              </div>
                            ) : rating.count > 0 ? (
                              <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <StarIcon
                                      key={i}
                                      className={`w-4 h-4 ${
                                        i < Math.round(rating.average)
                                          ? 'text-yellow-400 fill-current'
                                          : 'text-gray-400'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-sm">
                                  {rating.average.toFixed(1)} ({rating.count} review{rating.count !== 1 ? 's' : ''})
                                </span>
                              </div>
                            ) : null}

                            {/* Image Counter */}
                            <p className="text-xs text-white/60">
                              Image {(selectedImage.imageIndex || 0) + 1} of {catalogue.images.length + 1}
                            </p>
                          </div>

                          {/* Reviews Section */}
                          {reviews.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <MessageSquareIcon className="w-4 h-4" />
                                <h4 className="font-medium">Client Reviews</h4>
                              </div>
                              
                              <div className="space-y-4 max-h-60 overflow-y-auto">
                                {reviews.slice(0, 3).map((review) => (
                                  <div key={review.id} className="bg-white/10 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-medium text-sm">{review.clientName}</span>
                                      <div className="flex items-center">
                                        {[...Array(review.rating)].map((_, i) => (
                                          <StarIcon key={i} className="w-3 h-3 text-yellow-400 fill-current" />
                                        ))}
                                      </div>
                                    </div>
                                    <p className="text-xs text-white/80">{review.reviewText}</p>
                                    <p className="text-xs text-white/60 mt-1">
                                      {new Date(review.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                ))}
                                
                                {reviews.length > 3 && (
                                  <p className="text-xs text-white/60 text-center">
                                    And {reviews.length - 3} more review{reviews.length - 3 !== 1 ? 's' : ''}...
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Portfolio Navigation */}
                          <div className="mt-6 pt-4 border-t border-white/20">
                            <p className="text-xs text-white/60 text-center">
                              {filteredImages.findIndex(img => img.id === selectedImage.id) + 1} of {filteredImages.length} images
                            </p>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Fallback for images without catalogue */}
                {!selectedImage.catalogueId && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center text-white">
                    <Badge variant="secondary" className="mb-2">
                      {selectedImage.category}
                    </Badge>
                    <h3 className="text-lg font-semibold" data-testid="lightbox-title">
                      {selectedImage.title}
                    </h3>
                    <p className="text-sm text-white/80 mt-1">
                      {filteredImages.findIndex(img => img.id === selectedImage.id) + 1} of {filteredImages.length}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
