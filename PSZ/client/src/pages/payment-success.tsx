import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Calendar, MapPin, DollarSign, ArrowLeft, Home } from "lucide-react";

interface Booking {
  id: string;
  clientName: string;
  serviceType: string;
  packageType: string;
  shootDate: string;
  status: string;
  totalPrice: number;
  depositAmount: number;
  balanceDue: number;
  depositPaid: boolean;
  balancePaid: boolean;
}

export function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [bookingId, setBookingId] = useState<string>("");

  // Extract booking ID from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const booking = urlParams.get('booking');
    if (booking) {
      setBookingId(booking);
    }
  }, []);

  const { data: booking, isLoading } = useQuery<Booking>({
    queryKey: [`/api/bookings/${bookingId}/payment`],
    enabled: !!bookingId,
  });

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4">
              <CheckCircle className="w-16 h-16 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Invalid Payment Link</h2>
            <p className="text-gray-600 mb-4">
              This payment confirmation link is invalid or missing booking information.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-home">
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-4">
              <CheckCircle className="w-16 h-16 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Booking Not Found</h2>
            <p className="text-gray-600 mb-4">
              The booking associated with this payment could not be found.
            </p>
            <Button onClick={() => setLocation("/")} data-testid="button-home">
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatPrice = (amount: number) => `$${amount.toFixed(2)}`;
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <Card className="mb-6">
          <CardContent className="p-6 text-center">
            <div className="text-green-500 mb-4">
              <CheckCircle className="w-16 h-16 mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-green-800 mb-2" data-testid="text-success-title">
              Payment Successful!
            </h1>
            <p className="text-green-600">
              Thank you for your payment. Your booking has been updated.
            </p>
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Booking Details
            </CardTitle>
            <CardDescription>
              Confirmation for {booking.clientName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Service Type</label>
                <p className="text-lg capitalize" data-testid="text-service-type">
                  {booking.serviceType}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Package</label>
                <p className="text-lg capitalize" data-testid="text-package-type">
                  {booking.packageType}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Shoot Date</label>
                <p className="text-lg" data-testid="text-shoot-date">
                  {formatDate(booking.shootDate)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <Badge 
                  variant={booking.status === 'confirmed' ? 'default' : 'secondary'}
                  data-testid="badge-status"
                >
                  {booking.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <label className="text-sm font-medium text-gray-500 block">Total Price</label>
                <p className="text-xl font-bold" data-testid="text-total-price">
                  {formatPrice(booking.totalPrice)}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <label className="text-sm font-medium text-gray-500 block">Deposit</label>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xl font-bold text-green-600" data-testid="text-deposit-amount">
                    {formatPrice(booking.depositAmount)}
                  </p>
                  {booking.depositPaid && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <Badge 
                  variant={booking.depositPaid ? "default" : "secondary"}
                  className="mt-2"
                  data-testid="badge-deposit-status"
                >
                  {booking.depositPaid ? "Paid" : "Pending"}
                </Badge>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <label className="text-sm font-medium text-gray-500 block">Balance Due</label>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xl font-bold text-blue-600" data-testid="text-balance-due">
                    {formatPrice(booking.balanceDue)}
                  </p>
                  {booking.balancePaid && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
                <Badge 
                  variant={booking.balancePaid ? "default" : "secondary"}
                  className="mt-2"
                  data-testid="badge-balance-status"
                >
                  {booking.balancePaid ? "Paid" : "Pending"}
                </Badge>
              </div>
            </div>

            {!booking.balancePaid && booking.depositPaid && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Balance Payment</h4>
                <p className="text-yellow-700 text-sm">
                  Your remaining balance of {formatPrice(booking.balanceDue)} will be due before or at the time of your photoshoot. 
                  You'll receive payment instructions closer to your shoot date.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium">Confirmation Email</p>
                  <p className="text-sm text-gray-600">
                    You'll receive a confirmation email with all booking details shortly.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium">Pre-Shoot Communication</p>
                  <p className="text-sm text-gray-600">
                    We'll contact you 2-3 days before your shoot to confirm details and discuss any special requests.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div>
                  <p className="font-medium">Gallery Access</p>
                  <p className="text-sm text-gray-600">
                    After your photoshoot, you'll receive access to your private gallery with all photos.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/")}
            className="flex-1"
            data-testid="button-home"
          >
            <Home className="w-4 h-4 mr-2" />
            Return Home
          </Button>
          <Button 
            onClick={() => setLocation("/gallery")}
            className="flex-1"
            data-testid="button-gallery"
          >
            Access Gallery
          </Button>
        </div>

        {/* Contact Info */}
        <Card className="mt-6">
          <CardContent className="p-4 text-center text-sm text-gray-600">
            <p>
              Questions about your booking? Contact us at{" "}
              <a href="mailto:theconnectorphotography@gmail.com" className="text-green-600 hover:underline">
                theconnectorphotography@gmail.com
              </a>{" "}
              or{" "}
              <a href="tel:18763881801" className="text-green-600 hover:underline">
                (876) 388-1801
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}