import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { ArrowLeft, CreditCard, Heart } from "lucide-react";

export default function Payment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [booking, setBooking] = useState<any & { currency?: string }>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [tipInput, setTipInput] = useState('');

  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('booking');
  const paymentType = urlParams.get('type') || 'deposit'; // 'deposit' or 'balance'

  useEffect(() => {
    if (!bookingId) {
      navigate('/');
      return;
    }

    const fetchBooking = async () => {
      try {
        setIsLoading(true);
        const bookingResponse = await apiRequest('GET', `/api/bookings/${bookingId}/payment`);
        const bookingData = await bookingResponse.json();
        setBooking(bookingData);

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
      } catch (error: any) {
        toast({ title: "Error", description: error?.message || "Failed to load payment information", variant: "destructive" });
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId, paymentType]);

  const handlePay = async () => {
    if (!bookingId) return;
    try {
      setIsPaying(true);
      const checkoutResponse = await apiRequest('POST', '/api/create-payment-intent', {
        bookingId,
        paymentType,
        tipAmount,
      });
      const checkoutData = await checkoutResponse.json();
      if (checkoutData.error) throw new Error(checkoutData.error);

      if (checkoutData.autoMarked) {
        // Zero-amount balance (coupon, no tip) — auto-marked paid on server
        navigate(checkoutData.redirectUrl || `/payment-success?booking=${bookingId}&type=${paymentType}`);
        return;
      }

      window.location.href = checkoutData.checkoutUrl;
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to initiate payment", variant: "destructive" });
      setIsPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading"/>
      </div>
    );
  }

  if (!booking) {
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

  const currency = booking.currency || 'USD';
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

  const baseAmount = paymentType === 'balance' ? booking.balanceDue : booking.depositAmount;
  const totalCharge = baseAmount + (paymentType === 'balance' ? tipAmount : 0);

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
                  <span>{fmt(booking.totalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit:</span>
                  <span>{fmt(booking.depositAmount)} {booking.depositPaid ? '✓ Paid' : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span>Balance:</span>
                  <span>{fmt(booking.balanceDue)} {booking.balancePaid ? '✓ Paid' : ''}</span>
                </div>
              </div>
            </div>

            {/* Payment Amount */}
            <div className="text-center p-4 border-2 border-primary rounded-lg">
              <p className="text-sm text-muted-foreground">
                {paymentType === 'balance' ? 'Balance Due' : 'Deposit Amount'}
              </p>
              <p className="text-2xl font-bold text-primary">
                {fmt(baseAmount)}
              </p>
            </div>

            {/* Tip input — balance payments only */}
            {paymentType === 'balance' && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-yellow-600" />
                  <h4 className="font-semibold text-yellow-800">Leave a Tip (optional)</h4>
                </div>
                <p className="text-sm text-yellow-700">Show your appreciation for your photographer.</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-yellow-800">{currency}</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={tipInput}
                    onChange={e => {
                      setTipInput(e.target.value);
                      const v = parseFloat(e.target.value);
                      setTipAmount(isNaN(v) || v < 0 ? 0 : v);
                    }}
                    className="w-32"
                  />
                </div>
                {tipAmount > 0 && (
                  <p className="text-sm font-medium text-yellow-800">
                    Total charge: {fmt(totalCharge)}
                  </p>
                )}
              </div>
            )}

            {/* Payment Info */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-green-800 mb-1">Secure Payment</h4>
                  <p className="text-sm text-green-700">
                    {totalCharge === 0
                      ? 'Your balance is fully covered — click below to confirm.'
                      : 'You will be redirected to complete your payment securely through WiPay.'}
                  </p>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              data-testid="button-submit-payment"
              onClick={handlePay}
              disabled={isPaying}
            >
              {isPaying ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              {totalCharge === 0 ? 'Confirm Payment' : `Pay ${fmt(totalCharge)}`}
            </Button>

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
