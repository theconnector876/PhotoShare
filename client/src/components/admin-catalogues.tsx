import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImageIcon, FolderIcon, PlusIcon, EyeIcon, EditIcon, StarIcon, ArrowUp, ArrowDown, X, Trash2, Globe, EyeOff } from "lucide-react";
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
  sortOrder?: number;
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
  const [viewCatalogue, setViewCatalogue] = useState<Catalogue | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");

  const { data: catalogues, isLoading } = useQuery<Catalogue[]>({
    queryKey: ["/api/admin/catalogues"],
    retry: false,
  });

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ["/api/admin/reviews"],
    retry: false,
  });

  const orderedCatalogues = [...(catalogues || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  // Filter catalogues based on search and filter criteria
  const filteredCatalogues = orderedCatalogues.filter(catalogue => {
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        catalogue.title.toLowerCase().includes(searchLower) ||
        catalogue.description.toLowerCase().includes(searchLower) ||
        catalogue.serviceType.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "published" && !catalogue.isPublished) return false;
      if (statusFilter === "draft" && catalogue.isPublished) return false;
    }

    // Service type filter
    if (serviceTypeFilter !== "all" && catalogue.serviceType !== serviceTypeFilter) return false;

    return true;
  }) || [];

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

  const editForm = useForm<CatalogueFormData>({
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

  const getCatalogueReviews = (catalogueId: string) => {
    return reviews?.filter(review => review.catalogueId === catalogueId && review.isApproved) || [];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const createCatalogueMutation = useMutation({
    mutationFn: async (data: CatalogueFormData) => {
      const imagesArray = data.images.split('\n').map(url => url.trim()).filter(url => url);
      await apiRequest("POST", "/api/admin/catalogues", {
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
          window.location.href = "/auth";
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
      await apiRequest("PUT", `/api/admin/catalogues/${data.id}`, {
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
        description: "Catalogue changes have been saved.",
      });
      setIsEditDialogOpen(false);
      setSelectedCatalogue(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
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

  const deleteCatalogueMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/catalogues/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({ title: "Catalogue Deleted", description: "Catalogue has been permanently deleted." });
      setCatalogueToDelete(null);
      setIsDeleteDialogOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to delete catalogue.", variant: "destructive" }),
  });

  const publishCatalogueMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/catalogues/${id}/publish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({ title: "Published", description: "Catalogue is now live on the portfolio." });
    },
    onError: () => toast({ title: "Error", description: "Failed to publish catalogue.", variant: "destructive" }),
  });

  const unpublishCatalogueMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/admin/catalogues/${id}/unpublish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({ title: "Unpublished", description: "Catalogue moved back to drafts." });
    },
    onError: () => toast({ title: "Error", description: "Failed to unpublish catalogue.", variant: "destructive" }),
  });

  const reorderCataloguesMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("PATCH", "/api/admin/catalogues/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({
        title: "Order Updated",
        description: "Catalogue order has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update catalogue order.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CatalogueFormData) => {
    createCatalogueMutation.mutate(data);
  };

  const onEditSubmit = (data: CatalogueFormData) => {
    if (!selectedCatalogue) return;
    updateCatalogueMutation.mutate({ ...data, id: selectedCatalogue.id });
  };

  const openEditDialog = (catalogue: Catalogue) => {
    setSelectedCatalogue(catalogue);
    editForm.reset({
      title: catalogue.title,
      description: catalogue.description || "",
      serviceType: catalogue.serviceType as "photoshoot" | "wedding" | "event",
      coverImage: catalogue.coverImage,
      images: (catalogue.images || []).join("\n"),
      bookingId: catalogue.bookingId || "",
    });
    setIsEditDialogOpen(true);
  };

  const moveCatalogue = (catalogueId: string, direction: "up" | "down") => {
    const index = orderedCatalogues.findIndex((c) => c.id === catalogueId);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedCatalogues.length) return;
    const newOrder = [...orderedCatalogues];
    const [removed] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, removed);
    reorderCataloguesMutation.mutate(newOrder.map((c) => c.id));
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
                            <Input placeholder="Enter cover image URL" {...field} data-testid="input-cover-image" />
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
                          <FormLabel>Gallery Images</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Enter image URLs (one per line)" 
                              {...field} 
                              data-testid="input-images"
                              rows={5}
                            />
                          </FormControl>
                          <FormDescription>
                            Add image URLs, one per line
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-cancel-catalogue"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createCatalogueMutation.isPending}
                        data-testid="button-save-catalogue"
                      >
                        {createCatalogueMutation.isPending ? "Creating..." : "Create Catalogue"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit Catalogue</DialogTitle>
                  <DialogDescription>
                    Update the catalogue details, images, and cover.
                  </DialogDescription>
                </DialogHeader>
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                    <FormField
                      control={editForm.control}
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
                      control={editForm.control}
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
                      control={editForm.control}
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
                      control={editForm.control}
                      name="coverImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cover Image URL</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter cover image URL" {...field} data-testid="input-edit-cover-image" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="images"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gallery Images</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter image URLs (one per line)"
                              {...field}
                              data-testid="input-edit-images"
                              rows={5}
                            />
                          </FormControl>
                          <FormDescription>
                            Add image URLs, one per line
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditDialogOpen(false)}
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateCatalogueMutation.isPending}
                        data-testid="button-save-edit"
                      >
                        {updateCatalogueMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search by title, description, or service type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                  data-testid="input-search-catalogues"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>

              <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                <SelectTrigger data-testid="select-service-filter">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  <SelectItem value="photoshoot">Photoshoot</SelectItem>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setServiceTypeFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
              
              <div className="flex items-center">
                <div className="text-sm text-gray-600">
                  Showing {filteredCatalogues.length} of {catalogues?.length || 0} catalogues
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredCatalogues.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {catalogues?.length === 0 ? "No catalogues found. Create your first catalogue to showcase your work." : "No catalogues match your filters."}
              </div>
            ) : (
              filteredCatalogues.map((catalogue: Catalogue) => {
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
                            <h3 className="text-lg font-semibold" data-testid={`catalogue-title-${catalogue.id}`}>
                              {catalogue.title}
                            </h3>
                            <Badge variant={catalogue.isPublished ? "default" : "secondary"}>
                              {catalogue.isPublished ? "Published" : "Draft"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2" data-testid={`catalogue-description-${catalogue.id}`}>
                            {catalogue.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Service: {catalogue.serviceType}</span>
                            <span>Images: {catalogue.images?.length || 0}</span>
                            {catalogueReviews.length > 0 && (
                              <div className="flex items-center gap-1">
                                <StarIcon className="w-4 h-4 text-yellow-500" />
                                <span>{averageRating.toFixed(1)} ({catalogueReviews.length})</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            Created {formatDate(catalogue.createdAt)}
                          </div>
                          {catalogue.publishedAt && (
                            <div className="text-xs text-gray-500">
                              Published {formatDate(catalogue.publishedAt)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-between items-center pt-4 border-t gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm"
                            onClick={() => setViewCatalogue(catalogue)}
                            data-testid={`button-view-catalogue-${catalogue.id}`}>
                            <EyeIcon className="w-4 h-4 mr-1" /> View
                          </Button>
                          <Button variant="outline" size="sm"
                            onClick={() => openEditDialog(catalogue)}
                            data-testid={`button-edit-catalogue-${catalogue.id}`}>
                            <EditIcon className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          {catalogue.isPublished ? (
                            <Button variant="outline" size="sm"
                              onClick={() => unpublishCatalogueMutation.mutate(catalogue.id)}
                              disabled={unpublishCatalogueMutation.isPending}>
                              <EyeOff className="w-4 h-4 mr-1" /> Unpublish
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm"
                              onClick={() => publishCatalogueMutation.mutate(catalogue.id)}
                              disabled={publishCatalogueMutation.isPending}>
                              <Globe className="w-4 h-4 mr-1" /> Publish
                            </Button>
                          )}
                          <Button variant="outline" size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => { setCatalogueToDelete(catalogue); setIsDeleteDialogOpen(true); }}>
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm"
                            onClick={() => moveCatalogue(catalogue.id, "up")}
                            data-testid={`button-move-up-${catalogue.id}`}>
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm"
                            onClick={() => moveCatalogue(catalogue.id, "down")}
                            data-testid={`button-move-down-${catalogue.id}`}>
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Catalogue Preview Dialog */}
      <Dialog open={!!viewCatalogue} onOpenChange={open => !open && setViewCatalogue(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewCatalogue?.title}
              <Badge variant={viewCatalogue?.isPublished ? "default" : "secondary"} className="ml-2">
                {viewCatalogue?.isPublished ? "Published" : "Draft"}
              </Badge>
            </DialogTitle>
            <DialogDescription>{viewCatalogue?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4 text-sm text-gray-500">
              <span>Service: <strong className="capitalize">{viewCatalogue?.serviceType}</strong></span>
              <span>Images: <strong>{viewCatalogue?.images?.length || 0}</strong></span>
              {viewCatalogue?.createdAt && <span>Created: <strong>{formatDate(viewCatalogue.createdAt)}</strong></span>}
            </div>
            {viewCatalogue?.coverImage && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Cover Image</p>
                <img
                  src={viewCatalogue.coverImage}
                  alt="Cover"
                  className="w-full max-h-64 object-cover rounded-lg border cursor-pointer"
                  onClick={() => setPreviewImage(viewCatalogue.coverImage)}
                />
              </div>
            )}
            {viewCatalogue?.images && viewCatalogue.images.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Gallery Images ({viewCatalogue.images.length})</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {viewCatalogue.images.map((url, i) => (
                    <div key={i} className="aspect-square rounded overflow-hidden border bg-gray-100 cursor-pointer" onClick={() => setPreviewImage(url)}>
                      <img src={url} alt="" className="w-full h-full object-cover hover:opacity-80 transition-opacity" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Image Preview */}
      <Dialog open={!!previewImage} onOpenChange={open => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2">
          <img src={previewImage || ""} alt="Preview" className="w-full h-auto max-h-[80vh] object-contain rounded" />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open) { setIsDeleteDialogOpen(false); setCatalogueToDelete(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Catalogue</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{catalogueToDelete?.title}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setCatalogueToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="destructive"
              disabled={deleteCatalogueMutation.isPending}
              onClick={() => catalogueToDelete && deleteCatalogueMutation.mutate(catalogueToDelete.id)}>
              {deleteCatalogueMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}