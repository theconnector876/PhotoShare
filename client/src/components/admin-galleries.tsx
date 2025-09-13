import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageIcon, FolderIcon, UploadIcon } from "lucide-react";
// import { ObjectUploader } from "@/components/ObjectUploader"; // Temporarily disabled due to dependency issue
import { isUnauthorizedError } from "@/lib/authUtils";
// import type { UploadResult } from "@uppy/core"; // Temporarily disabled

interface Gallery {
  id: string;
  bookingId: string | null;
  clientEmail: string;
  accessCode: string;
  galleryImages: string[];
  selectedImages: string[];
  finalImages: string[];
  status: string;
  createdAt: string;
}

export function AdminGalleries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
  const [uploadType, setUploadType] = useState<'gallery' | 'selected' | 'final'>('gallery');

  const { data: galleries, isLoading } = useQuery<Gallery[]>({
    queryKey: ["/api/admin/galleries"],
    retry: false,
  });

  const addImageMutation = useMutation({
    mutationFn: async ({ galleryId, imageURL, type }: { galleryId: string; imageURL: string; type: string }) => {
      await apiRequest('/api/admin/gallery-images', 'PUT', { galleryId, imageURL, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/galleries"] });
      toast({
        title: "Image Added",
        description: "Image has been added to the gallery successfully.",
      });
      setSelectedGallery(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add image to gallery.",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest('/api/admin/objects/upload', 'POST', {});
      return response;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get upload parameters.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = (result: any) => { // UploadResult type temporarily disabled
    if (result.successful && result.successful.length > 0 && selectedGallery) {
      const uploadedFile = result.successful[0];
      const imageURL = uploadedFile.uploadURL;
      
      addImageMutation.mutate({
        galleryId: selectedGallery.id,
        imageURL: imageURL || '',
        type: uploadType
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-orange-500";
      case "selection":
        return "bg-blue-500";
      case "editing":
        return "bg-purple-500";
      case "completed":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Gallery Management
          </CardTitle>
          <CardDescription>
            Manage photo galleries for client bookings and image organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {galleries?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No galleries found.
              </div>
            ) : (
              galleries?.map((gallery: Gallery) => (
                <Card key={gallery.id} className="relative">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold" data-testid={`gallery-email-${gallery.id}`}>
                          {gallery.clientEmail}
                        </h3>
                        <p className="text-sm text-gray-600" data-testid={`gallery-code-${gallery.id}`}>
                          Access Code: {gallery.accessCode}
                        </p>
                        {gallery.bookingId && (
                          <p className="text-sm text-gray-600" data-testid={`gallery-booking-${gallery.id}`}>
                            Booking ID: {gallery.bookingId}
                          </p>
                        )}
                      </div>
                      <Badge 
                        className={`${getStatusColor(gallery.status)} text-white`}
                        data-testid={`gallery-status-${gallery.id}`}
                      >
                        {gallery.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <FolderIcon className="w-4 h-4 text-gray-500" />
                        <span data-testid={`gallery-images-${gallery.id}`}>
                          Gallery: {gallery.galleryImages?.length || 0} images
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-blue-500" />
                        <span data-testid={`selected-images-${gallery.id}`}>
                          Selected: {gallery.selectedImages?.length || 0} images
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-green-500" />
                        <span data-testid={`final-images-${gallery.id}`}>
                          Final: {gallery.finalImages?.length || 0} images
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <div className="text-xs text-gray-500">
                        Created on {formatDate(gallery.createdAt)}
                      </div>
                      <div className="flex gap-2">
                        {!selectedGallery ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedGallery(gallery)}
                            data-testid={`button-upload-${gallery.id}`}
                          >
                            <UploadIcon className="w-4 h-4 mr-2" />
                            Upload Images
                          </Button>
                        ) : selectedGallery.id === gallery.id ? (
                          <div className="flex items-center gap-2">
                            <Select value={uploadType} onValueChange={(value: any) => setUploadType(value)}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gallery">Gallery</SelectItem>
                                <SelectItem value="selected">Selected</SelectItem>
                                <SelectItem value="final">Final</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" disabled>
                              <UploadIcon className="w-4 h-4 mr-2" />
                              Add to {uploadType} (Upload temporarily disabled)
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedGallery(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-manage-${gallery.id}`}
                        >
                          Manage Gallery
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}