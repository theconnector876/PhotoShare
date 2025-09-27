import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  CalendarIcon, 
  MapPinIcon, 
  UsersIcon, 
  DollarSignIcon, 
  ClockIcon,
  Edit,
  Check,
  X,
  RefreshCw,
  Mail,
  Upload,
  Eye,
  FolderPlus,
  CreditCard,
  MessageSquare
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { SimpleUploader } from "@/components/SimpleUploader";

interface Booking {
  id: string;
  clientName: string;
  email: string;
  contactNumber: string;
  serviceType: string;
  packageType: string;
  numberOfPeople: number;
  shootDate: string;
  shootTime: string;
  location: string;
  parish: string;
  transportationFee: number;
  addons: string[];
  totalPrice: number;
  referralSource: string[];
  clientInitials: string;
  contractAccepted: boolean;
  status: string;
  depositPaid: boolean;
  balancePaid: boolean;
  depositAmount: number;
  balanceDue: number;
  createdAt: string;
}

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

const editBookingSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  email: z.string().email("Valid email is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  serviceType: z.enum(["photoshoot", "wedding", "event"]),
  packageType: z.string().min(1, "Package type is required"),
  numberOfPeople: z.number().min(1, "At least 1 person required"),
  shootDate: z.string().min(1, "Shoot date is required"),
  shootTime: z.string().min(1, "Shoot time is required"),
  location: z.string().min(1, "Location is required"),
  parish: z.string().min(1, "Parish is required"),
  totalPrice: z.number().min(0, "Total price must be positive"),
});

const emailMessageSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

const catalogueSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  coverImage: z.string().url("Cover image must be a valid URL"),
  images: z.string().min(1, "Images are required (one per line)"),
});

type EditBookingData = z.infer<typeof editBookingSchema>;
type EmailMessageData = z.infer<typeof emailMessageSchema>;
type CatalogueData = z.infer<typeof catalogueSchema>;

export function AdminBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [managementModalOpen, setManagementModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'edit' | 'email' | 'gallery' | 'upload' | 'catalogue'>('details');
  const [uploadType, setUploadType] = useState<'gallery' | 'selected' | 'final'>('gallery');
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/admin/bookings"],
    retry: false,
  });

  const { data: galleries } = useQuery<Gallery[]>({
    queryKey: ["/api/admin/galleries"],
    retry: false,
  });

  const editForm = useForm<EditBookingData>({
    resolver: zodResolver(editBookingSchema),
  });

  const emailForm = useForm<EmailMessageData>({
    resolver: zodResolver(emailMessageSchema),
    defaultValues: {
      subject: "",
      message: "",
    },
  });

  const catalogueForm = useForm<CatalogueData>({
    resolver: zodResolver(catalogueSchema),
    defaultValues: {
      title: "",
      description: "",
      coverImage: "",
      images: "",
    },
  });

  // Update booking status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest(`/api/admin/bookings/${id}/status`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({
        title: "Status Updated",
        description: "Booking status has been updated successfully.",
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
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update booking status.",
        variant: "destructive",
      });
    },
  });

  // Update booking details
  const updateBookingMutation = useMutation({
    mutationFn: async (data: EditBookingData & { id: string }) => {
      await apiRequest(`/api/admin/bookings/${data.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({
        title: "Booking Updated",
        description: "Booking details have been updated successfully.",
      });
      setEditingBooking(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update booking details.",
        variant: "destructive",
      });
    },
  });

  // Send email to client
  const sendEmailMutation = useMutation({
    mutationFn: async (data: EmailMessageData & { email: string; clientName: string }) => {
      await apiRequest("/api/admin/send-email", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Email Sent",
        description: "Email has been sent to the client successfully.",
      });
      setEmailModalOpen(false);
      emailForm.reset();
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to send email to client.",
        variant: "destructive",
      });
    },
  });

  // Upload images to gallery
  const uploadImageMutation = useMutation({
    mutationFn: async ({ galleryId, imageURL, type }: { galleryId: string; imageURL: string; type: string }) => {
      await apiRequest('/api/admin/gallery-images', 'PUT', { galleryId, imageURL, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/galleries"] });
      toast({
        title: "Image Uploaded",
        description: "Image has been uploaded to gallery successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload image to gallery.",
        variant: "destructive",
      });
    },
  });

  // Create catalogue from booking
  const createCatalogueMutation = useMutation({
    mutationFn: async (data: CatalogueData & { bookingId: string; serviceType: string }) => {
      const imagesArray = data.images.split('\n').map(url => url.trim()).filter(url => url);
      await apiRequest("/api/admin/catalogues", "POST", {
        title: data.title,
        description: data.description,
        serviceType: data.serviceType,
        coverImage: data.coverImage,
        images: imagesArray,
        bookingId: data.bookingId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/catalogues"] });
      toast({
        title: "Catalogue Created",
        description: "Portfolio catalogue has been created successfully.",
      });
      setCatalogueModalOpen(false);
      catalogueForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create catalogue.",
        variant: "destructive",
      });
    },
  });

  // Issue refund
  const refundMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      await apiRequest(`/api/admin/bookings/${bookingId}/refund`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      toast({
        title: "Refund Processed",
        description: "Refund has been initiated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process refund.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-orange-500";
      case "confirmed":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
      case "declined":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getBookingGallery = (bookingId: string) => {
    return galleries?.find(gallery => gallery.bookingId === bookingId);
  };

  const handleGetUploadParameters = async (): Promise<{ method: "PUT"; url: string }> => {
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

  const handleUploadComplete = (result: any) => {
    if (result.successful && result.successful.length > 0 && selectedGallery) {
      const uploadedFile = result.successful[0];
      const imageURL = uploadedFile.uploadURL;
      
      uploadImageMutation.mutate({
        galleryId: selectedGallery.id,
        imageURL: imageURL || '',
        type: uploadType
      });
    }
  };

  const openEditModal = (booking: Booking) => {
    setEditingBooking(booking);
    editForm.reset({
      clientName: booking.clientName,
      email: booking.email,
      contactNumber: booking.contactNumber,
      serviceType: booking.serviceType as any,
      packageType: booking.packageType,
      numberOfPeople: booking.numberOfPeople,
      shootDate: booking.shootDate,
      shootTime: booking.shootTime,
      location: booking.location,
      parish: booking.parish,
      totalPrice: booking.totalPrice,
    });
  };

  const openEmailModal = (booking: Booking) => {
    setSelectedBooking(booking);
    emailForm.reset({
      subject: `Regarding your ${booking.serviceType} booking`,
      message: `Dear ${booking.clientName},\n\nThank you for choosing The Connector Photography for your ${booking.serviceType} session.\n\nBest regards,\nThe Connector Photography Team`,
    });
    setEmailModalOpen(true);
  };

  const openManagementModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setActiveTab('details');
    setManagementModalOpen(true);
    
    // Pre-populate forms
    editForm.reset({
      clientName: booking.clientName,
      email: booking.email,
      contactNumber: booking.contactNumber,
      serviceType: booking.serviceType as any,
      packageType: booking.packageType,
      numberOfPeople: booking.numberOfPeople,
      shootDate: booking.shootDate,
      shootTime: booking.shootTime,
      location: booking.location,
      parish: booking.parish,
      totalPrice: booking.totalPrice,
    });

    emailForm.reset({
      subject: `Regarding your ${booking.serviceType} booking`,
      message: `Dear ${booking.clientName},\n\nThank you for choosing The Connector Photography for your ${booking.serviceType} session.\n\nBest regards,\nThe Connector Photography Team`,
    });

    catalogueForm.reset({
      title: `${booking.clientName} - ${booking.serviceType}`,
      description: `Beautiful ${booking.serviceType} session for ${booking.clientName}`,
      coverImage: "",
      images: "",
    });

    // Set gallery if exists
    const gallery = getBookingGallery(booking.id);
    if (gallery) {
      setSelectedGallery(gallery);
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
            <CalendarIcon className="w-5 h-5" />
            Booking Management
          </CardTitle>
          <CardDescription>
            Manage bookings, communicate with clients, upload photos, and create catalogues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            {bookings?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No bookings found.
              </div>
            ) : (
              bookings?.map((booking: Booking) => (
                <Card 
                  key={booking.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-300"
                  onClick={() => openManagementModal(booking)}
                >
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold" data-testid={`booking-name-${booking.id}`}>
                            {booking.clientName}
                          </h3>
                          <Badge
                            className={`text-white ${getStatusColor(booking.status)}`}
                            data-testid={`booking-status-${booking.id}`}
                          >
                            {booking.status}
                          </Badge>
                          <Badge variant="outline">
                            {booking.serviceType}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{booking.email}</p>
                        <p className="text-sm text-gray-600">{booking.contactNumber}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(booking.totalPrice)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Deposit: {booking.depositPaid ? "✓ Paid" : "Pending"} ({formatCurrency(booking.depositAmount)})
                        </div>
                        <div className="text-sm text-gray-500">
                          Balance: {booking.balancePaid ? "✓ Paid" : "Pending"} ({formatCurrency(booking.balanceDue)})
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span>{booking.shootDate} at {booking.shootTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-4 h-4 text-gray-500" />
                        <span>{booking.location}, {booking.parish}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-gray-500" />
                        <span>{booking.numberOfPeople} people</span>
                      </div>
                    </div>

                    <div className="text-center py-2">
                      <p className="text-sm text-gray-500 italic">Click to manage this booking</p>
                    </div>

                    <div className="text-xs text-gray-500 mt-4 pt-4 border-t">
                      Booked on {formatDate(booking.createdAt)}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comprehensive Booking Management Modal */}
      {managementModalOpen && selectedBooking && (
        <Dialog open={true} onOpenChange={() => setManagementModalOpen(false)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Manage Booking - {selectedBooking.clientName}</span>
                <div className="flex items-center gap-2">
                  <Badge className={`text-white ${getStatusColor(selectedBooking.status)}`}>
                    {selectedBooking.status}
                  </Badge>
                  {selectedBooking.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: selectedBooking.id, status: "confirmed" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: selectedBooking.id, status: "declined" })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>
            
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-4">
              {[
                { key: 'details', label: 'Details', icon: Eye },
                { key: 'edit', label: 'Edit', icon: Edit },
                { key: 'email', label: 'Email', icon: Mail },
                { key: 'gallery', label: 'Gallery', icon: Eye },
                { key: 'upload', label: 'Upload', icon: Upload },
                { key: 'catalogue', label: 'Catalogue', icon: FolderPlus }
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={activeTab === key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(key as any)}
                  className="flex-1"
                >
                  <Icon className="w-4 h-4 mr-1" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Client Name</Label>
                      <p className="font-medium">{selectedBooking.clientName}</p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p>{selectedBooking.email}</p>
                    </div>
                    <div>
                      <Label>Contact Number</Label>
                      <p>{selectedBooking.contactNumber}</p>
                    </div>
                    <div>
                      <Label>Service Type</Label>
                      <p className="capitalize">{selectedBooking.serviceType}</p>
                    </div>
                    <div>
                      <Label>Package</Label>
                      <p>{selectedBooking.packageType}</p>
                    </div>
                    <div>
                      <Label>Number of People</Label>
                      <p>{selectedBooking.numberOfPeople}</p>
                    </div>
                    <div>
                      <Label>Shoot Date</Label>
                      <p>{selectedBooking.shootDate}</p>
                    </div>
                    <div>
                      <Label>Shoot Time</Label>
                      <p>{selectedBooking.shootTime}</p>
                    </div>
                    <div>
                      <Label>Location</Label>
                      <p>{selectedBooking.location}</p>
                    </div>
                    <div>
                      <Label>Parish</Label>
                      <p>{selectedBooking.parish}</p>
                    </div>
                    <div>
                      <Label>Transportation Fee</Label>
                      <p>{formatCurrency(selectedBooking.transportationFee)}</p>
                    </div>
                    <div>
                      <Label>Total Price</Label>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(selectedBooking.totalPrice)}</p>
                    </div>
                  </div>
                  
                  {selectedBooking.addons && selectedBooking.addons.length > 0 && (
                    <div>
                      <Label>Add-ons</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedBooking.addons.map((addon, index) => (
                          <Badge key={index} variant="outline">{addon}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Deposit Amount</Label>
                      <p>{formatCurrency(selectedBooking.depositAmount)} - {selectedBooking.depositPaid ? "✓ Paid" : "Pending"}</p>
                    </div>
                    <div>
                      <Label>Balance Due</Label>
                      <p>{formatCurrency(selectedBooking.balanceDue)} - {selectedBooking.balancePaid ? "✓ Paid" : "Pending"}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {(selectedBooking.depositPaid || selectedBooking.balancePaid) && (
                      <Button
                        variant="outline"
                        onClick={() => refundMutation.mutate(selectedBooking.id)}
                        disabled={refundMutation.isPending}
                      >
                        <CreditCard className="w-4 h-4 mr-1" />
                        Issue Refund
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Edit Tab */}
              {activeTab === 'edit' && (
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit((data) => {
                    updateBookingMutation.mutate({ ...data, id: selectedBooking.id });
                    setManagementModalOpen(false);
                  })} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="clientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="contactNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                                <SelectTrigger>
                                  <SelectValue />
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
                        name="packageType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Package Type</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="numberOfPeople"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of People</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="shootDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shoot Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="shootTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shoot Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="parish"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parish</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="totalPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Price</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button type="submit" disabled={updateBookingMutation.isPending}>
                        {updateBookingMutation.isPending ? "Updating..." : "Update Booking"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

      {/* Email Modal */}
      {emailModalOpen && selectedBooking && (
        <Dialog open={true} onOpenChange={() => setEmailModalOpen(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send Email to {selectedBooking.clientName}</DialogTitle>
              <DialogDescription>
                Send a message to {selectedBooking.email}
              </DialogDescription>
            </DialogHeader>
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit((data) => sendEmailMutation.mutate({ ...data, email: selectedBooking.email, clientName: selectedBooking.clientName }))} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={8} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setEmailModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={sendEmailMutation.isPending}>
                    {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Upload Photos Modal */}
      {uploadModalOpen && selectedGallery && selectedBooking && (
        <Dialog open={true} onOpenChange={() => setUploadModalOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Photos - {selectedBooking.clientName}</DialogTitle>
              <DialogDescription>
                Upload photos to the client's gallery
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Upload Type</Label>
                <Select value={uploadType} onValueChange={(value: any) => setUploadType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gallery">Gallery Images (for client selection)</SelectItem>
                    <SelectItem value="selected">Pre-selected Images</SelectItem>
                    <SelectItem value="final">Final Edited Images</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SimpleUploader
                maxNumberOfFiles={10}
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Photos
              </SimpleUploader>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* View Gallery Modal */}
      {viewGalleryModalOpen && selectedGallery && selectedBooking && (
        <Dialog open={true} onOpenChange={() => setViewGalleryModalOpen(false)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gallery - {selectedBooking.clientName}</DialogTitle>
              <DialogDescription>
                View gallery images and client selections
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-4 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">{selectedGallery.galleryImages.length}</div>
                  <div>Gallery Images</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded">
                  <div className="text-2xl font-bold text-orange-600">{selectedGallery.selectedImages.length}</div>
                  <div>Selected Images</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded">
                  <div className="text-2xl font-bold text-green-600">{selectedGallery.finalImages.length}</div>
                  <div>Final Images</div>
                </div>
              </div>
              
              {selectedGallery.selectedImages.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Client's Selected Images:</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedGallery.selectedImages.slice(0, 6).map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Selected ${index + 1}`}
                        className="w-full h-24 object-cover rounded"
                      />
                    ))}
                  </div>
                  {selectedGallery.selectedImages.length > 6 && (
                    <p className="text-sm text-gray-500 mt-2">
                      And {selectedGallery.selectedImages.length - 6} more images...
                    </p>
                  )}
                </div>
              )}
              
              <div className="text-sm text-gray-500">
                Access Code: <strong>{selectedGallery.accessCode}</strong>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Catalogue Modal */}
      {catalogueModalOpen && selectedBooking && (
        <Dialog open={true} onOpenChange={() => setCatalogueModalOpen(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Portfolio Catalogue</DialogTitle>
              <DialogDescription>
                Create a portfolio catalogue from {selectedBooking.clientName}'s session
              </DialogDescription>
            </DialogHeader>
            <Form {...catalogueForm}>
              <form onSubmit={catalogueForm.handleSubmit((data) => createCatalogueMutation.mutate({ ...data, bookingId: selectedBooking.id, serviceType: selectedBooking.serviceType }))} className="space-y-4">
                <FormField
                  control={catalogueForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={catalogueForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={catalogueForm.control}
                  name="coverImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Image URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={catalogueForm.control}
                  name="images"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Images (one URL per line)</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={5} placeholder="https://image1.jpg&#10;https://image2.jpg&#10;https://image3.jpg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCatalogueModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCatalogueMutation.isPending}>
                    {createCatalogueMutation.isPending ? "Creating..." : "Create Catalogue"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}