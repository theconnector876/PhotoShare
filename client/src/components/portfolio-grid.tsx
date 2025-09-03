import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface PortfolioImage {
  id: string;
  src: string;
  alt: string;
  category: string;
  title: string;
}

interface PortfolioGridProps {
  preview?: boolean;
}

export default function PortfolioGrid({ preview = false }: PortfolioGridProps) {
  const [selectedImage, setSelectedImage] = useState<PortfolioImage | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const portfolioImages: PortfolioImage[] = [
    {
      id: '1',
      src: "https://images.unsplash.com/photo-1606216794074-735e91aa2c92?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Elegant wedding portrait in garden setting",
      category: "wedding",
      title: "Garden Wedding Portrait"
    },
    {
      id: '2', 
      src: "https://pixabay.com/get/g9a9065d2c34f829358b9acae6e452cd3cbd8efbe245b24abebf022d4e1cf5502912f866525496252efc7dab920c9a318a6e2f7507f260833d76a422bac7b0f80_1280.jpg",
      alt: "Beach portrait session with golden hour lighting",
      category: "portrait",
      title: "Golden Hour Beach Session"
    },
    {
      id: '3',
      src: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Professional event photography at luxury venue",
      category: "event",
      title: "Corporate Event Coverage"
    },
    {
      id: '4',
      src: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Artistic portrait with creative studio lighting",
      category: "portrait",
      title: "Studio Portrait Session"
    },
    {
      id: '5',
      src: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Jamaican landscape during golden hour",
      category: "landscape",
      title: "Jamaican Sunset"
    },
    {
      id: '6',
      src: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Couple photography in tropical paradise setting",
      category: "couple",
      title: "Tropical Couple Session"
    },
    {
      id: '7',
      src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Fashion photography with vibrant backdrop",
      category: "fashion",
      title: "Fashion Editorial"
    },
    {
      id: '8',
      src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Professional headshot with studio lighting",
      category: "portrait",
      title: "Professional Headshots"
    },
    {
      id: '9',
      src: "https://images.unsplash.com/photo-1573766064535-6d5d4e62bf9d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Wedding ceremony in Jamaica",
      category: "wedding",
      title: "Beach Wedding Ceremony"
    },
    {
      id: '10',
      src: "https://images.unsplash.com/photo-1464207687429-7505649dae38?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Corporate event photography",
      category: "event",
      title: "Business Conference"
    },
    {
      id: '11',
      src: "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Family portrait session",
      category: "family",
      title: "Family Portrait Session"
    },
    {
      id: '12',
      src: "https://images.unsplash.com/photo-1582405947445-d675ac7a381f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800",
      alt: "Maternity photography session",
      category: "maternity",
      title: "Maternity Session"
    }
  ];

  const categories = ['all', 'wedding', 'portrait', 'event', 'couple', 'family', 'fashion', 'landscape', 'maternity'];
  
  const displayImages = preview 
    ? portfolioImages.slice(0, 8)
    : portfolioImages;

  const filteredImages = selectedCategory === 'all' 
    ? displayImages 
    : displayImages.filter(img => img.category === selectedCategory);

  const openLightbox = (image: PortfolioImage) => {
    setSelectedImage(image);
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
      {filteredImages.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-images text-muted-foreground text-2xl"></i>
          </div>
          <h3 className="text-xl font-semibold mb-2">No Images Found</h3>
          <p className="text-muted-foreground">
            No images available for the selected category. Try selecting a different category.
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
              <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <img
                  src={selectedImage.src}
                  alt={selectedImage.alt}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  data-testid="lightbox-image"
                />
                
                {/* Image Info */}
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
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
