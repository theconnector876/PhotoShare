import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImageIcon, FolderIcon, PlusIcon, EyeIcon, EditIcon, ShareIcon, StarIcon, TrashIcon } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface Catalogue {
  id: string;
  title: string;
  description: string;
  serviceType: string;
  coverImage: string;
  images: string[];
  isPublished: boolean;
  bookingId: string | null;
  createdAt: string;
  publishedAt: string | null;
}

interface Review {
  id: string;
  clientName: string;
  rating: number;
  reviewText: string;
  reviewType: string;
  catalogueId: string | null;
  isApproved: boolean;
  createdAt: string;
}

const catalogueFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  serviceType: z.enum(["photoshoot", "wedding", "event"]),
  coverImage: z.string().url("Must be a valid URL"),
  images: z.string().min(1, "At least one image is required"),
  bookingId: z.string().optional(),
});

type CatalogueFormData = z.infer<typeof catalogueFormSchema>;

export function AdminCatalogues() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCatalogue, setSelectedCatalogue] = useState<Catalogue | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [catalogueToDelete, setCatalogueToDelete] = useState<Catalogue | null>(null);

  const { data: catalogues, isLoading } = useQuery<Catalogue[]>({
    queryKey: ["/api/admin/catalogues"],
    retry: false,
  });

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ["/api/admin/reviews"],
    retry: false,
  });

  const form = useForm<CatalogueFormData>({
    resolver: zodResolver(catalogueFormSchema),
    defaultValues: {
      title: "",
      description: "",
      serviceType: "photoshoot",
      coverImage: "",
      images: "",
      bookingId: "",
    },
  });

  const createCatalogueMutation = useMutation({
    mutationFn: async (data: CatalogueFormData) => {
      const imagesArray = data.images.split('\n').map(url => url.trim()).filter(url => url);
      await apiRequest("/api/admin/catalogues", "POST", {
        ...data,
        images: imagesArray,
        bookingId: data.bookingId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({
        title: "Catalogue Created",
        description: "New catalogue has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      form.reset();
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
        description: "Failed to create catalogue.",
        variant: "destructive",
      });
    },
  });

  const updateCatalogueMutation = useMutation({
    mutationFn: async (data: CatalogueFormData & { id: string }) => {
      const imagesArray = data.images.split('\n').map(url => url.trim()).filter(url => url);
      await apiRequest(`/api/admin/catalogues/${data.id}`, "PATCH", {
        title: data.title,
        description: data.description,
        serviceType: data.serviceType,
        coverImage: data.coverImage,
        images: imagesArray,
        bookingId: data.bookingId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({
        title: "Catalogue Updated",
        description: "Catalogue has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedCatalogue(null);
      form.reset();
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
        description: "Failed to update catalogue.",
        variant: "destructive",
      });
    },
  });

  const publishCatalogueMutation = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      await apiRequest(`/api/admin/catalogues/${id}/publish`, "PATCH", { publish });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({
        title: "Publication Status Updated",
        description: "Catalogue publication status has been updated successfully.",
      });
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
        description: "Failed to update publication status.",
        variant: "destructive",
      });
    },
  });

  const approveReviewMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      await apiRequest(`/api/admin/reviews/${id}/approve`, "PATCH", { approve });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Review Updated",
        description: "Review approval status has been updated successfully.",
      });
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
        description: "Failed to update review approval.",
        variant: "destructive",
      });
    },
  });

  const deleteCatalogueMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/admin/catalogues/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({
        title: "Catalogue Deleted",
        description: "Catalogue has been deleted successfully.",
      });
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
        description: "Failed to delete catalogue.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getServiceTypeColor = (serviceType: string) => {
    switch (serviceType) {
      case "wedding":
        return "bg-pink-500";
      case "photoshoot":
        return "bg-blue-500";
      case "event":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const getCatalogueReviews = (catalogueId: string) => {
    return reviews?.filter(review => review.catalogueId === catalogueId) || [];
  };

  const handleEditCatalogue = (catalogue: Catalogue) => {
    setSelectedCatalogue(catalogue);
    form.reset({
      title: catalogue.title,
      description: catalogue.description,
      serviceType: catalogue.serviceType as "photoshoot" | "wedding" | "event",
      coverImage: catalogue.coverImage,
      images: catalogue.images.join('\n'),
      bookingId: catalogue.bookingId || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteCatalogue = (catalogue: Catalogue) => {
    setCatalogueToDelete(catalogue);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (catalogueToDelete) {
      deleteCatalogueMutation.mutate(catalogueToDelete.id);
      setIsDeleteDialogOpen(false);
      setCatalogueToDelete(null);
    }
  };

  const onSubmit = (data: CatalogueFormData) => {
    if (selectedCatalogue) {
      updateCatalogueMutation.mutate({ ...data, id: selectedCatalogue.id });
    } else {
      createCatalogueMutation.mutate(data);
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
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderIcon className="w-5 h-5" />
                Portfolio Catalogues
              </CardTitle>
              <CardDescription>
                Manage your completed work catalogues and their publication status.
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-catalogue">
                  <PlusIcon className="w-4 h-4 mr-2" />
                  Create Catalogue
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Catalogue</DialogTitle>
                  <DialogDescription>
                    Upload your completed work to create a new portfolio catalogue.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter catalogue title" {...field} data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Describe this catalogue..." {...field} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="serviceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-service-type">
                                <SelectValue placeholder="Select service type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="photoshoot">Photoshoot</SelectItem>
                              <SelectItem value="wedding">Wedding</SelectItem>
                              <SelectItem value="event">Event</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="coverImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cover Image URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/cover-image.jpg" {...field} data-testid="input-cover-image" />
                          </FormControl>
                          <FormDescription>
                            URL of the cover image for this catalogue
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="images"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Image URLs</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg&#10;https://example.com/image3.jpg"
                              {...field} 
                              data-testid="input-images"
                              rows={6}
                            />
                          </FormControl>
                          <FormDescription>
                            Enter one image URL per line
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bookingId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Booking ID (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Link to specific booking" {...field} data-testid="input-booking-id" />
                          </FormControl>
                          <FormDescription>
                            Link this catalogue to a specific booking for client access
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createCatalogueMutation.isPending}
                        data-testid="button-submit"
                      >
                        {createCatalogueMutation.isPending ? "Creating..." : "Create Catalogue"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {catalogues?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No catalogues found. Create your first catalogue to showcase your work.
              </div>
            ) : (
              catalogues?.map((catalogue: Catalogue) => {
                const catalogueReviews = getCatalogueReviews(catalogue.id);
                const averageRating = catalogueReviews.length > 0 
                  ? catalogueReviews.reduce((sum, review) => sum + review.rating, 0) / catalogueReviews.length 
                  : 0;

                return (
                  <Card key={catalogue.id} className="relative">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <ImageIcon className="w-4 h-4 text-gray-500" />
                            <h3 className="text-lg font-semibold text-green-800" data-testid={`text-title-${catalogue.id}`}>
                              {catalogue.title}
                            </h3>
                          </div>
                          <p className="text-gray-600 mb-2" data-testid={`text-description-${catalogue.id}`}>
                            {catalogue.description}
                          </p>
                          <div className="flex items-center gap-4 mb-3">
                            <Badge 
                              className={`text-white ${getServiceTypeColor(catalogue.serviceType)}`}
                              data-testid={`badge-service-${catalogue.id}`}
                            >
                              {catalogue.serviceType}
                            </Badge>
                            <Badge 
                              variant={catalogue.isPublished ? "default" : "secondary"}
                              data-testid={`badge-status-${catalogue.id}`}
                            >
                              {catalogue.isPublished ? "Published" : "Draft"}
                            </Badge>
                            {catalogueReviews.length > 0 && (
                              <div className="flex items-center gap-1" data-testid={`rating-${catalogue.id}`}>
                                <StarIcon className="w-4 h-4 text-yellow-500 fill-current" />
                                <span className="text-sm font-medium">
                                  {averageRating.toFixed(1)} ({catalogueReviews.length})
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            <p>Images: {catalogue.images.length}</p>
                            <p>Created: {formatDate(catalogue.createdAt)}</p>
                            {catalogue.publishedAt && (
                              <p>Published: {formatDate(catalogue.publishedAt)}</p>
                            )}
                            {catalogue.bookingId && (
                              <p>Linked to booking: {catalogue.bookingId}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCatalogue(catalogue)}
                            data-testid={`button-edit-${catalogue.id}`}
                          >
                            <EditIcon className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant={catalogue.isPublished ? "destructive" : "default"}
                            size="sm"
                            onClick={() => publishCatalogueMutation.mutate({ 
                              id: catalogue.id, 
                              publish: !catalogue.isPublished 
                            })}
                            disabled={publishCatalogueMutation.isPending}
                            data-testid={`button-publish-${catalogue.id}`}
                          >
                            <ShareIcon className="w-4 h-4 mr-1" />
                            {catalogue.isPublished ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteCatalogue(catalogue)}
                            data-testid={`button-delete-${catalogue.id}`}
                          >
                            <TrashIcon className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                      {catalogueReviews.length > 0 && (
                        <div className="mt-4 pt-4 border-t">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Reviews:</h4>
                          <div className="space-y-2">
                            {catalogueReviews.slice(0, 2).map((review) => (
                              <div key={review.id} className="text-sm bg-gray-50 p-2 rounded">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{review.clientName}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center">
                                      {[...Array(review.rating)].map((_, i) => (
                                        <StarIcon key={i} className="w-3 h-3 text-yellow-500 fill-current" />
                                      ))}
                                    </div>
                                    <Badge 
                                      variant={review.isApproved ? "default" : "secondary"}
                                      className="text-xs"
                                    >
                                      {review.isApproved ? "Approved" : "Pending"}
                                    </Badge>
                                    {!review.isApproved && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => approveReviewMutation.mutate({ 
                                          id: review.id, 
                                          approve: true 
                                        })}
                                        disabled={approveReviewMutation.isPending}
                                        data-testid={`button-approve-review-${review.id}`}
                                      >
                                        Approve
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-600 mt-1">{review.reviewText}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Catalogue</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{catalogueToDelete?.title}"? This action cannot be undone.
              {catalogueToDelete?.isPublished && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-orange-800">
                  <strong>Warning:</strong> This catalogue is currently published and visible to clients.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setCatalogueToDelete(null);
              }}
              data-testid="button-delete-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteCatalogueMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteCatalogueMutation.isPending ? "Deleting..." : "Delete Catalogue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Catalogue Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Catalogue</DialogTitle>
            <DialogDescription>
              Update the catalogue details and images.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter catalogue title" {...field} data-testid="input-edit-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe this catalogue..." {...field} data-testid="input-edit-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-service-type">
                          <SelectValue placeholder="Select service type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="photoshoot">Photoshoot</SelectItem>
                        <SelectItem value="wedding">Wedding</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="coverImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover Image URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/cover-image.jpg" {...field} data-testid="input-edit-cover-image" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URLs</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                        {...field} 
                        data-testid="input-edit-images"
                        rows={6}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter one image URL per line
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bookingId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Link to specific booking" {...field} data-testid="input-edit-booking-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedCatalogue(null);
                    form.reset();
                  }}
                  data-testid="button-edit-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateCatalogueMutation.isPending}
                  data-testid="button-edit-submit"
                >
                  {updateCatalogueMutation.isPending ? "Updating..." : "Update Catalogue"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}