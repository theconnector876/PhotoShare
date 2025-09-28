import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageIcon, FolderIcon, UploadIcon, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewGalleryId, setViewGalleryId] = useState<string | null>(null);

  const { data: galleries, isLoading } = useQuery<Gallery[]>({
    queryKey: ["/api/admin/galleries"],
    retry: false,
  });

  // Filter galleries based on search and filter criteria
  const filteredGalleries = galleries?.filter(gallery => {
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        gallery.clientEmail.toLowerCase().includes(searchLower) ||
        gallery.id.toLowerCase().includes(searchLower) ||
        gallery.accessCode.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== "all" && gallery.status !== statusFilter) return false;

    return true;
  }) || [];

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
      case "active":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const openGalleryView = (gallery: Gallery) => {
    const galleryUrl = `/gallery/${gallery.clientEmail}/${gallery.accessCode}`;
    window.open(galleryUrl, '_blank');
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
          {/* Search and Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search by client email, gallery ID, or access code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                  data-testid="input-search-galleries"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>

            <div className="text-sm text-gray-600">
              Showing {filteredGalleries.length} of {galleries?.length || 0} galleries
            </div>
          </div>

          <div className="grid gap-4">
            {filteredGalleries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {galleries?.length === 0 ? "No galleries found." : "No galleries match your filters."}
              </div>
            ) : (
              filteredGalleries.map((gallery: Gallery) => (
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openGalleryView(gallery)}
                          data-testid={`button-view-gallery-${gallery.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Gallery
                        </Button>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedGallery(null)}
                              data-testid={`button-cancel-upload-${gallery.id}`}
                            >
                              Cancel
                            </Button>
                            {/* <ObjectUploader
                              getUploadParameters={handleGetUploadParameters}
                              onUploadComplete={handleUploadComplete}
                              trigger={
                                <Button size="sm" data-testid={`button-upload-trigger-${gallery.id}`}>
                                  <UploadIcon className="w-4 h-4 mr-2" />
                                  Upload to {uploadType}
                                </Button>
                              }
                            /> */}
                          </div>
                        ) : null}
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