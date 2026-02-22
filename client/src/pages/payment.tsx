import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { ArrowLeft, CreditCard } from "lucide-react";

export default function Payment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get booking ID from URL params - use window.location.search for query params
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('booking');
  const paymentType = urlParams.get('type') || 'deposit'; // 'deposit' or 'balance'

  useEffect(() => {
    if (!bookingId) {
      navigate('/');
      return;
    }

    const fetchBookingAndCreatePayment = async () => {
      try {
        setIsLoading(true);

        // Get booking details (public payment endpoint)
        const bookingResponse = await apiRequest('GET', `/api/bookings/${bookingId}/payment`);
        const bookingData = await bookingResponse.json();
        setBooking(bookingData);

        // Guard: payment already made or deposit not paid first
        if (paymentType === 'balance') {
          if (!bookingData.depositPaid) {
            toast({ title: "Deposit Required", description: "Please pay the deposit first", variant: "destructive" });
            navigate(`/payment?booking=${bookingId}&type=deposit`);
            return;
          }
          if (bookingData.balancePaid) {
            toast({ title: "Already Paid", description: "The balance has already been paid" });
            navigate('/dashboard');
            return;
          }
        } else {
          if (bookingData.depositPaid) {
            toast({ title: "Already Paid", description: "The deposit has already been paid" });
            navigate('/dashboard');
            return;
          }
        }

        // Create Lemon Squeezy checkout
        const checkoutResponse = await apiRequest('POST', '/api/create-payment-intent', { bookingId, paymentType });
        const checkoutData = await checkoutResponse.json();
        if (checkoutData.error) {
          throw new Error(checkoutData.error);
        }
        setCheckoutUrl(checkoutData.checkoutUrl);
      } catch (error: any) {
        toast({ title: "Error", description: error?.message || "Failed to load payment information", variant: "destructive" });
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookingAndCreatePayment();
  }, [bookingId, paymentType, navigate, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (!checkoutUrl || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p>Unable to load payment information</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amount = paymentType === 'balance' ? booking.balanceDue : booking.depositAmount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 py-8">
      <div className="container max-w-2xl mx-auto px-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              {paymentType === 'balance' ? 'Final Payment' : 'Deposit Payment'}
            </CardTitle>
            <CardDescription>
              Complete your {paymentType === 'balance' ? 'final' : 'deposit'} payment for booking #{booking.id.slice(-8)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Booking Summary */}
            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Booking Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Service:</span>
                  <span className="capitalize">{booking.serviceType} - {booking.packageType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{booking.shootDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Amount:</span>
                  <span>${booking.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit:</span>
                  <span>${booking.depositAmount.toFixed(2)} {booking.depositPaid ? '✓ Paid' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span>Balance:</span>
                  <span>${booking.balanceDue.toFixed(2)} {booking.balancePaid ? '✓ Paid' : ''}</span>
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div className="text-center p-4 border-2 border-primary rounded-lg">
              <p className="text-sm text-muted-foreground">
                {paymentType === 'balance' ? 'Final Payment Amount' : 'Deposit Amount'}
              </p>
              <p className="text-2xl font-bold text-primary">
                ${amount.toFixed(2)}
              </p>
            </div>

            {/* Payment Info */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-800 mb-1">Secure Payment</h4>
                  <p className="text-sm text-green-700">
                    You will be redirected to complete your payment securely through Lemon Squeezy.
                  </p>
                </div>
              </div>
            </div>

            {/* Pay Button — opens Lemon Squeezy overlay checkout */}
            <Button
              className="w-full"
              data-testid="button-submit-payment"
              onClick={() => {
                const ls = (window as any).LemonSqueezy;
                if (ls?.Url?.Open) {
                  ls.Url.Open(checkoutUrl);
                } else {
                  window.location.href = checkoutUrl;
                }
              }}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Pay ${amount.toFixed(2)}
            </Button>

            {/* Contact */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Having trouble? Contact us at{' '}
                <a href="mailto:support@connectagrapher.com" className="text-primary hover:underline">
                  support@connectagrapher.com
                </a>{' '}
                or{' '}
                <a href="tel:18763881801" className="text-primary hover:underline">
                  (876) 388-1801
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
