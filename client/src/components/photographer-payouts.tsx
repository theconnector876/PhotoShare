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
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { BanknoteIcon, Clock, CheckCircle2, XCircle, Loader2, AlertCircle, ChevronDown, ChevronUp, ImageIcon, ExternalLink } from "lucide-react";
import type { Booking } from "@shared/schema";

interface PayoutDetails {
  method?: "bank";
  bankName?: string;
  bankBranch?: string;
  accountHolderName?: string;
  accountNumber?: string;
  accountType?: string;       // Savings | Chequing
  routingNumber?: string;     // Sort code / routing (domestic)
  swiftCode?: string;         // SWIFT/BIC (international transfers)
  currency?: string;          // JMD | USD
  notes?: string;
}

interface BookingSnapshot {
  id: string;
  clientName: string;
  serviceType: string;
  shootDate: string;
  totalPrice: number;
  depositPaid: boolean;
  balancePaid: boolean;
  grossPaid: number;
  platformFee: number;
  photographerCut: number;
}

interface Payout {
  id: string;
  bookingIds: string[];
  amount: number;
  currency: string;
  status: string;
  payoutMethod: string | null;
  payoutDetails: Record<string, any> | null;
  adminNotes: string | null;
  referenceNumber: string | null;
  receiptUrl: string | null;
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

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

export function PhotographerPayouts({ bookings }: { bookings: Booking[] }) {
  const { toast } = useToast();

  const [form, setForm] = useState<PayoutDetails>({ method: "bank" });
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [expandedPayoutId, setExpandedPayoutId] = useState<string | null>(null);

  const { data: savedDetails } = useQuery<PayoutDetails>({
    queryKey: ["/api/photographer/payout-details"],
    onSuccess: (d) => {
      if (d && Object.keys(d).length > 0) setForm({ ...d, method: "bank" });
    },
  } as any);

  const { data: payoutHistory = [] } = useQuery<Payout[]>({
    queryKey: ["/api/photographer/payouts"],
    refetchInterval: 30000,
  });

  const { data: payoutConfig } = useQuery<{ percentage: number }>({
    queryKey: ["/api/admin/payout-config"],
  });
  const payoutPct = payoutConfig?.percentage ?? 70;

  const saveDetailsMutation = useMutation({
    mutationFn: (data: PayoutDetails) => apiRequest("PUT", "/api/photographer/payout-details", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/payout-details"] });
      toast({ title: "Bank details saved!" });
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

  const f = (key: keyof PayoutDetails) => ({
    value: form[key] as string ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value })),
  });

  const hasDetails = !!(savedDetails?.accountHolderName && savedDetails?.accountNumber && savedDetails?.bankName);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="request">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="request">Request Payout</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Bank Details</TabsTrigger>
        </TabsList>

        {/* ── REQUEST PAYOUT ─────────────────────────────────────── */}
        <TabsContent value="request" className="space-y-4 mt-4">
          {!hasDetails && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="flex gap-3 p-4">
                <AlertCircle className="text-yellow-600 mt-0.5 shrink-0" size={18} />
                <p className="text-sm text-yellow-800">
                  Set up your <strong>Bank Details</strong> first so we know where to send your payment.
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
                  disabled={requestPayoutMutation.isPending || !hasDetails}
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
              const isExpanded = expandedPayoutId === p.id;
              const details = p.payoutDetails as Record<string, any> | null;
              const snapshots: BookingSnapshot[] = details?.bookingsSnapshot ?? [];
              const pct: number = details?.payoutPct ?? payoutPct;
              const totalGross = snapshots.reduce((s, b) => s + b.grossPaid, 0);
              const totalFee = snapshots.reduce((s, b) => s + b.platformFee, 0);

              return (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={cfg.variant} className="gap-1">
                            {cfg.icon} {cfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(p.requestedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {p.bookingIds.length} booking{p.bookingIds.length > 1 ? "s" : ""} · Bank Wire
                        </p>
                        {p.referenceNumber && (
                          <p className="text-xs text-muted-foreground mt-1">Ref: {p.referenceNumber}</p>
                        )}
                        {p.adminNotes && (
                          <p className="text-xs italic text-muted-foreground mt-1">"{p.adminNotes}"</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <p className="text-xl font-bold text-green-700">
                          {formatAmount(p.amount, p.currency)}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => setExpandedPayoutId(isExpanded ? null : p.id)}
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                          {isExpanded ? "Hide" : "View receipt"}
                        </Button>
                      </div>
                    </div>

                    {/* Expandable receipt section */}
                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t pt-4">

                        {/* Connectagrapher receipt breakdown */}
                        {snapshots.length > 0 ? (
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                            <p className="font-semibold text-blue-800 text-xs uppercase tracking-wide mb-2">
                              Connectagrapher Receipt
                            </p>
                            <div className="space-y-2">
                              {snapshots.map(b => (
                                <div key={b.id} className="flex justify-between text-xs border-b border-blue-100 pb-1">
                                  <div>
                                    <p className="font-medium">{b.clientName}</p>
                                    <p className="text-muted-foreground capitalize">{b.serviceType} · {b.shootDate}</p>
                                    <div className="flex gap-1 mt-0.5">
                                      {b.depositPaid && <span className="text-[10px] bg-white border rounded px-1">Deposit</span>}
                                      {b.balancePaid && <span className="text-[10px] bg-white border rounded px-1">Balance</span>}
                                    </div>
                                  </div>
                                  <div className="text-right space-y-0.5 shrink-0 pl-3">
                                    <p className="text-muted-foreground">Collected: {fmt(b.grossPaid, p.currency)}</p>
                                    <p className="text-orange-700">Fee ({100 - pct}%): −{fmt(b.platformFee, p.currency)}</p>
                                    <p className="font-semibold text-green-700">Your cut ({pct}%): {fmt(b.photographerCut, p.currency)}</p>
                                  </div>
                                </div>
                              ))}
                              <Separator />
                              <div className="flex justify-between text-sm font-semibold">
                                <span>Total</span>
                                <div className="text-right space-y-0.5">
                                  <p className="text-muted-foreground text-xs">Collected: {fmt(totalGross, p.currency)}</p>
                                  <p className="text-orange-700 text-xs">Platform fee: −{fmt(totalFee, p.currency)}</p>
                                  <p className="text-green-700">Your payout: {fmt(p.amount, p.currency)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No detailed breakdown available for this payout.
                          </p>
                        )}

                        {/* Bank receipt from admin */}
                        {p.receiptUrl && (
                          <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                            <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">Bank Transfer Receipt</p>
                            {p.receiptUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img
                                src={p.receiptUrl}
                                alt="Bank receipt"
                                className="max-h-48 rounded border object-contain w-full"
                              />
                            ) : null}
                            <a
                              href={p.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                            >
                              <ImageIcon className="w-3 h-3" /> Open receipt <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {!p.receiptUrl && (
                          <p className="text-xs text-muted-foreground italic">No bank receipt uploaded yet.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── BANK DETAILS ────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BanknoteIcon className="w-4 h-4" /> Bank Wire Details
              </CardTitle>
              <CardDescription>
                Your bank details are only visible to admins when processing your payout. All transfers are done manually via bank wire.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Required fields */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Account Holder Name <span className="text-red-500">*</span></Label>
                  <Input placeholder="Full name as on the account" {...f("accountHolderName")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Number <span className="text-red-500">*</span></Label>
                  <Input placeholder="Your account number" {...f("accountNumber")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bank Name <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. NCB, Scotiabank, JN Bank" {...f("bankName")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Input placeholder="e.g. Cross Roads, Half Way Tree" {...f("bankBranch")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Account Type</Label>
                  <Select
                    value={form.accountType ?? ""}
                    onValueChange={(v) => setForm(prev => ({ ...prev, accountType: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="chequing">Chequing / Current</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Preferred Payout Currency</Label>
                  <Select
                    value={form.currency ?? ""}
                    onValueChange={(v) => setForm(prev => ({ ...prev, currency: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JMD">JMD – Jamaican Dollar</SelectItem>
                      <SelectItem value="USD">USD – US Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Optional wire fields */}
              <div className="border-t pt-4 space-y-1 mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Optional — for transfers from outside Jamaica</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Sort Code / Routing Number</Label>
                  <Input placeholder="Domestic routing / sort code" {...f("routingNumber")} />
                </div>
                <div className="space-y-1.5">
                  <Label>SWIFT / BIC Code</Label>
                  <Input placeholder="e.g. JNCBJMKX" {...f("swiftCode")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Additional Instructions</Label>
                <Textarea
                  placeholder="Any special instructions for the transfer..."
                  rows={2}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <Button
                onClick={() => saveDetailsMutation.mutate({ ...form, method: "bank" })}
                disabled={saveDetailsMutation.isPending || !form.bankName || !form.accountHolderName || !form.accountNumber}
                className="w-full sm:w-auto"
              >
                {saveDetailsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Bank Details
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
