import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, MapPinIcon, UsersIcon, DollarSignIcon, ClockIcon } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

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
  createdAt: string;
}

export function AdminBookings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/admin/bookings"],
    retry: false,
  });

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
          window.location.href = "/api/login";
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
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "cancelled":
        return "bg-red-500";
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
            <CalendarIcon className="w-5 h-5" />
            Booking Management
          </CardTitle>
          <CardDescription>
            Manage and update booking statuses for all photography sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {bookings?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No bookings found.
              </div>
            ) : (
              bookings?.map((booking: Booking) => (
                <Card key={booking.id} className="relative">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold" data-testid={`booking-name-${booking.id}`}>
                          {booking.clientName}
                        </h3>
                        <p className="text-sm text-gray-600" data-testid={`booking-email-${booking.id}`}>
                          {booking.email}
                        </p>
                        <p className="text-sm text-gray-600" data-testid={`booking-phone-${booking.id}`}>
                          {booking.contactNumber}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge 
                          className={`${getStatusColor(booking.status)} text-white`}
                          data-testid={`booking-status-${booking.id}`}
                        >
                          {booking.status.toUpperCase()}
                        </Badge>
                        <Select
                          value={booking.status}
                          onValueChange={(status) => 
                            updateStatusMutation.mutate({ id: booking.id, status })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span data-testid={`booking-date-${booking.id}`}>
                          {booking.shootDate} at {booking.shootTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="w-4 h-4 text-gray-500" />
                        <span data-testid={`booking-location-${booking.id}`}>
                          {booking.location}, {booking.parish}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-gray-500" />
                        <span data-testid={`booking-people-${booking.id}`}>
                          {booking.numberOfPeople} people
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-4">
                      <div>
                        <span className="font-medium">Service: </span>
                        <span className="capitalize" data-testid={`booking-service-${booking.id}`}>
                          {booking.serviceType} - {booking.packageType}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Transportation: </span>
                        <span data-testid={`booking-transport-${booking.id}`}>
                          {formatCurrency(booking.transportationFee)}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Total: </span>
                        <span className="text-lg font-bold text-green-600" data-testid={`booking-total-${booking.id}`}>
                          {formatCurrency(booking.totalPrice)}
                        </span>
                      </div>
                    </div>

                    {booking.addons && booking.addons.length > 0 && (
                      <div className="mt-4">
                        <span className="font-medium text-sm">Add-ons: </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {booking.addons.map((addon, index) => (
                            <Badge key={index} variant="outline" data-testid={`booking-addon-${booking.id}-${index}`}>
                              {addon}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <div className="text-xs text-gray-500">
                        Booked on {formatDate(booking.createdAt)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBooking(booking)}
                          data-testid={`button-view-${booking.id}`}
                        >
                          View Details
                        </Button>
                        {booking.status === "confirmed" && (
                          <Button
                            size="sm"
                            onClick={() => 
                              updateStatusMutation.mutate({ id: booking.id, status: "completed" })
                            }
                            disabled={updateStatusMutation.isPending}
                            data-testid={`button-complete-${booking.id}`}
                          >
                            Mark Complete
                          </Button>
                        )}
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