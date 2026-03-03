import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { BanknoteIcon, CreditCard, Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import type { Booking } from "@shared/schema";

interface PayoutDetails {
  method?: "bank" | "card";
  bankName?: string;
  bankBranch?: string;
  accountHolderName?: string;
  accountNumber?: string;
  routingNumber?: string;
  cardHolderName?: string;
  cardNumber?: string;
  cardType?: string;
  cardIssuingBank?: string;
  notes?: string;
}

interface Payout {
  id: string;
  bookingIds: string[];
  amount: number;
  currency: string;
  status: string;
  payoutMethod: string | null;
  adminNotes: string | null;
  referenceNumber: string | null;
  requestedAt: string;
  processedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending:    { label: "Pending Review", variant: "secondary",    icon: <Clock className="w-3 h-3" /> },
  processing: { label: "Processing",     variant: "default",      icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed:  { label: "Paid",           variant: "default",      icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected:   { label: "Rejected",       variant: "destructive",  icon: <XCircle className="w-3 h-3" /> },
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);
}

export function PhotographerPayouts({ bookings }: { bookings: Booking[] }) {
  const { toast } = useToast();

  // ── Payout details form state
  const [method, setMethod] = useState<"bank" | "card">("bank");
  const [form, setForm] = useState<PayoutDetails>({});

  // ── Payout request state
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);

  const { data: savedDetails, isLoading: detailsLoading } = useQuery<PayoutDetails>({
    queryKey: ["/api/photographer/payout-details"],
    onSuccess: (d) => {
      if (d?.method) {
        setMethod(d.method);
        setForm(d);
      }
    },
  } as any);

  const { data: payoutHistory = [] } = useQuery<Payout[]>({
    queryKey: ["/api/photographer/payouts"],
  });

  const { data: payoutConfig } = useQuery<{ percentage: number }>({
    queryKey: ["/api/admin/payout-config"],
  });
  const payoutPct = payoutConfig?.percentage ?? 70;

  const saveDetailsMutation = useMutation({
    mutationFn: (data: PayoutDetails) => apiRequest("PUT", "/api/photographer/payout-details", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/payout-details"] });
      toast({ title: "Payout details saved!" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const requestPayoutMutation = useMutation({
    mutationFn: (bookingIds: string[]) =>
      apiRequest("POST", "/api/photographer/payouts/request", { bookingIds, currency: "USD" }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/payouts"] });
      setSelectedBookingIds([]);
      toast({ title: "Payout requested!", description: `${formatAmount(data.amount, data.currency)} will be processed shortly.` });
    },
    onError: async (err: any) => {
      const msg = err?.response ? (await err.response.json().catch(() => ({}))).error : err.message;
      toast({ title: "Request failed", description: msg || "Please try again.", variant: "destructive" });
    },
  });

  // Eligible bookings: completed, photographer assigned, payment received
  const alreadyRequestedIds = new Set(
    payoutHistory
      .filter(p => ["pending", "processing", "completed"].includes(p.status))
      .flatMap(p => p.bookingIds)
  );

  const eligibleBookings = bookings.filter(b =>
    b.status === "completed" &&
    (b.depositPaid || b.balancePaid) &&
    !alreadyRequestedIds.has(b.id)
  );

  const calcEarnings = (b: Booking) => {
    const depositAmt = Math.round(b.totalPrice * 0.5);
    const paid = (b.depositPaid ? depositAmt : 0) + (b.balancePaid ? (b.totalPrice - depositAmt) : 0);
    return Math.round(paid * payoutPct / 100);
  };

  const selectedTotal = eligibleBookings
    .filter(b => selectedBookingIds.includes(b.id))
    .reduce((sum, b) => sum + calcEarnings(b), 0);

  const handleSave = () => {
    saveDetailsMutation.mutate({ ...form, method });
  };

  const f = (key: keyof PayoutDetails) => ({
    value: form[key] as string ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="request">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="request">Request Payout</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Payout Settings</TabsTrigger>
        </TabsList>

        {/* ── REQUEST PAYOUT ─────────────────────────────────────── */}
        <TabsContent value="request" className="space-y-4 mt-4">
          {!savedDetails?.method && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="flex gap-3 p-4">
                <AlertCircle className="text-yellow-600 mt-0.5 shrink-0" size={18} />
                <p className="text-sm text-yellow-800">
                  Set up your <strong>Payout Settings</strong> first so we know where to send your funds.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Eligible Bookings</CardTitle>
              <CardDescription>
                Select completed bookings to include in this payout. You earn {payoutPct}% of the received amount.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {eligibleBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No eligible bookings yet. Bookings must be marked <strong>Completed</strong> with at least the deposit paid.
                </p>
              ) : (
                eligibleBookings.map(b => {
                  const earnings = calcEarnings(b);
                  const isChecked = selectedBookingIds.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                      onClick={() => setSelectedBookingIds(prev =>
                        isChecked ? prev.filter(id => id !== b.id) : [...prev, b.id]
                      )}
                    >
                      <Checkbox checked={isChecked} className="pointer-events-none" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{b.clientName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{b.serviceType} · {b.shootDate}</p>
                        <div className="flex gap-2 mt-1">
                          {b.depositPaid && <Badge variant="outline" className="text-xs py-0">Deposit paid</Badge>}
                          {b.balancePaid && <Badge variant="outline" className="text-xs py-0">Balance paid</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-green-700">${(earnings / 100).toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">{payoutPct}% of ${Math.round((b.depositPaid ? Math.round(b.totalPrice * 0.5) : 0) + (b.balancePaid ? b.totalPrice - Math.round(b.totalPrice * 0.5) : 0))}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {selectedBookingIds.length > 0 && (
            <Card className="bg-primary/5 border-primary">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{selectedBookingIds.length} booking{selectedBookingIds.length > 1 ? "s" : ""} selected</p>
                  <p className="text-2xl font-bold text-primary">${(selectedTotal / 100).toFixed(0)}</p>
                </div>
                <Button
                  onClick={() => requestPayoutMutation.mutate(selectedBookingIds)}
                  disabled={requestPayoutMutation.isPending || !savedDetails?.method}
                >
                  {requestPayoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Request Payout
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── HISTORY ────────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-3 mt-4">
          {payoutHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No payout requests yet.</p>
          ) : (
            payoutHistory.map(p => {
              const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
              return (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={cfg.variant} className="gap-1">
                            {cfg.icon} {cfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(p.requestedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {p.bookingIds.length} booking{p.bookingIds.length > 1 ? "s" : ""} · via {p.payoutMethod === "bank" ? "Bank Wire" : "Card Deposit"}
                        </p>
                        {p.referenceNumber && (
                          <p className="text-xs text-muted-foreground mt-1">Ref: {p.referenceNumber}</p>
                        )}
                        {p.adminNotes && (
                          <p className="text-xs italic text-muted-foreground mt-1">"{p.adminNotes}"</p>
                        )}
                      </div>
                      <p className="text-xl font-bold text-green-700 shrink-0">
                        {formatAmount(p.amount, p.currency)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── SETTINGS ───────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payout Method</CardTitle>
              <CardDescription>
                Choose how you'd like to receive your earnings. Your details are stored securely and only visible to admins when processing payouts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={method}
                onValueChange={(v) => setMethod(v as "bank" | "card")}
                className="grid grid-cols-2 gap-3"
              >
                <Label
                  htmlFor="method-bank"
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${method === "bank" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <RadioGroupItem value="bank" id="method-bank" />
                  <BanknoteIcon className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Bank Wire</p>
                    <p className="text-xs text-muted-foreground">Direct to account</p>
                  </div>
                </Label>
                <Label
                  htmlFor="method-card"
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${method === "card" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <RadioGroupItem value="card" id="method-card" />
                  <CreditCard className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">Card Deposit</p>
                    <p className="text-xs text-muted-foreground">Direct to card</p>
                  </div>
                </Label>
              </RadioGroup>

              <Separator />

              {method === "bank" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Bank Name *</Label>
                    <Input placeholder="e.g. NCB, Scotiabank" {...f("bankName")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Branch</Label>
                    <Input placeholder="e.g. Cross Roads, Kingston" {...f("bankBranch")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account Holder Name *</Label>
                    <Input placeholder="Name on the account" {...f("accountHolderName")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Account Number *</Label>
                    <Input placeholder="Account number" {...f("accountNumber")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Routing / Sort Code</Label>
                    <Input placeholder="Routing or sort code (if applicable)" {...f("routingNumber")} />
                  </div>
                </div>
              )}

              {method === "card" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Card Holder Name *</Label>
                    <Input placeholder="Name on card" {...f("cardHolderName")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Card Number (last 4 digits) *</Label>
                    <Input placeholder="e.g. 4242" maxLength={4} {...f("cardNumber")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Card Type</Label>
                    <Input placeholder="e.g. Visa, Mastercard" {...f("cardType")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Issuing Bank *</Label>
                    <Input placeholder="e.g. NCB, JN Bank" {...f("cardIssuingBank")} />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Additional Notes</Label>
                <Textarea
                  placeholder="Any special instructions for the transfer..."
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saveDetailsMutation.isPending}
                className="w-full sm:w-auto"
              >
                {saveDetailsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Payout Details
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
