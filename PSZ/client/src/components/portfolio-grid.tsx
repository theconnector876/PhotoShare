import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X, StarIcon, MessageSquareIcon, AlertCircleIcon, RefreshCwIcon } from "lucide-react";

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

  const queryClient = useQueryClient();

  // Fetch published catalogues
  const { data: catalogues, isLoading, isError, error } = useQuery<Catalogue[]>({
    queryKey: ["/api/catalogues"],
    retry: 2,
  });

  // We'll fetch catalogue-specific reviews in the lightbox when needed
  const [catalogueReviews, setCatalogueReviews] = useState<{ [key: string]: Review[] }>({});
  const [loadingReviews, setLoadingReviews] = useState<{ [key: string]: boolean }>({});

  // Transform catalogues into portfolio images
  const portfolioImages: PortfolioImage[] = catalogues ? catalogues.flatMap((catalogue) => {
    // Use cover image as first image, then include additional images
    const allImages = [catalogue.coverImage, ...catalogue.images];
    
    return allImages.map((imageUrl, index) => ({
      id: `${catalogue.id}-${index}`,
      src: imageUrl,
      alt: `${catalogue.title} - Image ${index + 1}`,
      category: catalogue.serviceType,
      title: index === 0 ? catalogue.title : `${catalogue.title} - Image ${index + 1}`,
      catalogueId: catalogue.id,
      imageIndex: index
    }));
  }) : [];

  // Get catalogue details
  const getCurrentCatalogue = (catalogueId?: string): Catalogue | undefined => {
    if (!catalogueId || !catalogues) return undefined;
    return catalogues.find(cat => cat.id === catalogueId);
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
  
  const displayImages = preview 
    ? portfolioImages.slice(0, 8)
    : portfolioImages;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-16" data-testid="status-error-catalogues">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircleIcon className="text-red-500 text-2xl w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold mb-2 text-red-700">Failed to Load Portfolio</h3>
        <p className="text-gray-600 mb-4">
          We couldn't load the portfolio images. Please check your connection and try again.
        </p>
        <Button 
          onClick={handleRetry}
          variant="outline"
          className="gap-2"
          data-testid="button-retry-catalogues"
        >
          <RefreshCwIcon className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Category Filter - Only show if not preview */}
      {!preview && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
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
      )}

      {/* Image Grid */}
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${preview ? 'mb-0' : 'mb-12'}`}>
        {filteredImages.map((image, index) => (
          <Card
            key={image.id}
            className="relative aspect-square overflow-hidden rounded-xl hover-3d group cursor-pointer transition-all duration-300"
            onClick={() => openLightbox(image)}
            data-testid={`portfolio-image-${index}`}
          >
            <img
              src={image.src}
              alt={image.alt}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
              <div className="text-center text-white">
                <Badge variant="secondary" className="mb-2 text-xs">
                  {image.category}
                </Badge>
                <div className="text-sm font-semibold">{image.title}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredImages.length === 0 && !isLoading && (
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
