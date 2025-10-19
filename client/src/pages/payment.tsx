import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { ArrowLeft, CreditCard } from "lucide-react";

// Lemon Squeezy checkout button component
const LemonSqueezyCheckout = ({ checkoutUrl, amount, paymentType, onError }: { 
  checkoutUrl: string; 
  amount: number; 
  paymentType: string;
  onError: (error: string) => void;
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = () => {
    try {
      setIsLoading(true);
      
      // Check if Lemon.js is available
      if (typeof window !== 'undefined' && (window as any).LemonSqueezy) {
        // Open Lemon Squeezy checkout overlay
        (window as any).LemonSqueezy.Url.Open(checkoutUrl);
      } else {
        // Fallback: open in new tab
        window.open(checkoutUrl, '_blank');
      }
      
      // Show success message
      toast({
        title: "Opening Payment",
        description: "You will be redirected to complete your payment securely with Lemon Squeezy",
      });
    } catch (error) {
      console.error('Error opening checkout:', error);
      onError('Failed to open payment checkout');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleCheckout}
      disabled={isLoading}
      className="w-full"
      data-testid="button-submit-payment"
    >
      {isLoading ? (
        <>
          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
          Opening Payment...
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4 mr-2" />
          Pay ${amount.toFixed(2)}
        </>
      )}
    </Button>
  );
};

export default function Payment() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get booking ID from URL params - use window.location.search for query params
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('booking');
  const paymentType = urlParams.get('type') || 'deposit'; // 'deposit' or 'balance'

  // Load Lemon.js script
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).LemonSqueezy) {
      const script = document.createElement('script');
      script.src = 'https://app.lemonsqueezy.com/js/lemon.js';
      script.defer = true;
      script.onload = () => {
        // Initialize Lemon.js
        if ((window as any).createLemonSqueezy) {
          (window as any).createLemonSqueezy();
        }
      };
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    }
  }, []);

  useEffect(() => {
    console.log('Payment page loaded, bookingId:', bookingId, 'paymentType:', paymentType);
    
    if (!bookingId) {
      console.log('No booking ID, redirecting to home');
      navigate('/');
      return;
    }

    const fetchBookingAndCreatePayment = async () => {
      try {
        console.log('Fetching booking and creating payment for:', bookingId);
        setIsLoading(true);
        
        // Get booking details (public payment endpoint)
        const bookingResponse = await apiRequest('GET', `/api/bookings/${bookingId}/payment`);
        const bookingData = await bookingResponse.json();
        console.log('Booking data received:', bookingData);
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

        // Create Lemon Squeezy checkout
        console.log('Creating payment intent for booking:', bookingId);
        const checkoutResponse = await apiRequest('POST', '/api/create-payment-intent', {
          bookingId,
          paymentType
        });
        const checkoutData = await checkoutResponse.json();
        console.log('Checkout data received:', checkoutData);
        setCheckoutUrl(checkoutData.checkoutUrl);
      } catch (error) {
        console.error('Error in fetchBookingAndCreatePayment:', error);
        toast({
          title: "Error",
          description: "Failed to load payment information",
          variant: "destructive",
        });
        console.log('Error occurred, redirecting to home');
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

  if (!checkoutUrl || !booking) {
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
                    Your payment will be processed securely through Lemon Squeezy. 
                    You'll be redirected to complete your payment and can return here afterward.
                  </p>
                </div>
              </div>
            </div>

            {/* Lemon Squeezy Checkout Button */}
            <LemonSqueezyCheckout 
              checkoutUrl={checkoutUrl}
              amount={amount}
              paymentType={paymentType}
              onError={(error) => {
                toast({
                  title: "Payment Error",
                  description: error,
                  variant: "destructive",
                });
              }}
            />

            {/* Alternative Payment Notice */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Having trouble? Contact us at{' '}
                <a href="mailto:theconnectorphotography@gmail.com" className="text-primary hover:underline">
                  theconnectorphotography@gmail.com
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