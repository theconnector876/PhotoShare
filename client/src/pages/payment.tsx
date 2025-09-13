import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { ArrowLeft, CreditCard } from "lucide-react";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

const PaymentForm = ({ bookingId, amount, onSuccess }: { bookingId: string; amount: number; onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?booking=${bookingId}`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        onSuccess();
      }
    } catch (err) {
      toast({
        title: "Payment Error",
        description: "Something went wrong processing your payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full"
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay ${(amount / 100).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
};

export default function Payment() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState("");
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get booking ID from URL params
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const bookingId = urlParams.get('booking');
  const paymentType = urlParams.get('type') || 'deposit'; // 'deposit' or 'balance'

  // Check for Stripe configuration early
  if (!stripePublicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Payment Setup Required</h2>
            <p className="text-muted-foreground mb-4">
              Payment processing is not configured yet. Please contact us to complete your booking.
            </p>
            <Button onClick={() => navigate('/')} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    if (!bookingId) {
      navigate('/');
      return;
    }

    const fetchBookingAndCreatePayment = async () => {
      try {
        setIsLoading(true);
        
        // Get booking details
        const bookingResponse = await apiRequest('GET', `/api/bookings/${bookingId}`);
        const bookingData = await bookingResponse.json();
        setBooking(bookingData);

        // Determine amount based on payment type
        let amount: number;
        if (paymentType === 'balance') {
          amount = bookingData.balanceDue;
          // Check if deposit was paid
          if (!bookingData.depositPaid) {
            toast({
              title: "Deposit Required",
              description: "Please pay the deposit first before paying the balance",
              variant: "destructive",
            });
            navigate(`/payment?booking=${bookingId}&type=deposit`);
            return;
          }
          // Check if balance already paid
          if (bookingData.balancePaid) {
            toast({
              title: "Already Paid",
              description: "The balance for this booking has already been paid",
            });
            navigate('/dashboard');
            return;
          }
        } else {
          amount = bookingData.depositAmount;
          // Check if deposit already paid
          if (bookingData.depositPaid) {
            toast({
              title: "Already Paid",
              description: "The deposit for this booking has already been paid",
            });
            navigate('/dashboard');
            return;
          }
        }

        // Create payment intent
        const paymentResponse = await apiRequest('POST', '/api/create-payment-intent', {
          bookingId,
          paymentType
        });
        const paymentData = await paymentResponse.json();
        setClientSecret(paymentData.clientSecret);
      } catch (error) {
        console.error('Error:', error);
        toast({
          title: "Error",
          description: "Failed to load payment information",
          variant: "destructive",
        });
        navigate('/');
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

  if (!clientSecret || !booking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p>Unable to load payment information</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
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
                  <span>${(booking.totalPrice / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit:</span>
                  <span>${(booking.depositAmount / 100).toFixed(2)} {booking.depositPaid ? '✓ Paid' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span>Balance:</span>
                  <span>${(booking.balanceDue / 100).toFixed(2)} {booking.balancePaid ? '✓ Paid' : ''}</span>
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div className="text-center p-4 border-2 border-primary rounded-lg">
              <p className="text-sm text-muted-foreground">
                {paymentType === 'balance' ? 'Final Payment Amount' : 'Deposit Amount'}
              </p>
              <p className="text-2xl font-bold text-primary">
                ${(amount / 100).toFixed(2)}
              </p>
            </div>

            {/* Payment Form */}
            {stripePromise ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm 
                  bookingId={booking.id}
                  amount={amount}
                  onSuccess={() => {
                    toast({
                      title: "Payment Successful",
                      description: `Your ${paymentType} payment has been processed successfully!`,
                    });
                    navigate('/dashboard');
                  }}
                />
              </Elements>
            ) : (
              <div className="text-center p-4 border-2 border-destructive rounded-lg">
                <p className="text-destructive">Payment processing is not available. Please contact us directly.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}