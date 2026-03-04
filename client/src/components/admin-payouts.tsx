import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BanknoteIcon, CheckCircle2, XCircle, Clock, Loader2, Settings, Upload, ImageIcon, ExternalLink } from "lucide-react";

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

interface PayoutRow {
  id: string;
  photographerId: string;
  photographerName: string | null;
  photographerEmail: string | null;
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

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:    { label: "Pending",    variant: "secondary" },
  processing: { label: "Processing", variant: "default" },
  completed:  { label: "Paid",       variant: "default" },
  rejected:   { label: "Rejected",   variant: "destructive" },
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);
}

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}

async function uploadReceiptToCloudinary(file: File): Promise<string> {
  const sigRes = await apiRequest("GET", "/api/upload-signature");
  const { signature, timestamp, apiKey, cloudName, folder } = await sigRes.json();

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("folder", folder ?? "receipts");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Receipt upload failed");
  const data = await res.json();
  return data.secure_url as string;
}

export function AdminPayouts() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<PayoutRow | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [payoutPctInput, setPayoutPctInput] = useState<number>(70);
  const receiptFileRef = useRef<HTMLInputElement>(null);

  const { data: payouts = [], isLoading } = useQuery<PayoutRow[]>({
    queryKey: ["/api/admin/payouts"],
  });

  const { data: payoutConfig } = useQuery<{ percentage: number }>({
    queryKey: ["/api/admin/payout-config"],
    onSuccess: (d) => setPayoutPctInput(d.percentage),
  } as any);

  const updateMutation = useMutation({
    mutationFn: ({ id, status, adminNotes, referenceNumber, receiptUrl }: {
      id: string; status: string; adminNotes?: string; referenceNumber?: string; receiptUrl?: string;
    }) => apiRequest("PATCH", `/api/admin/payouts/${id}`, { status, adminNotes, referenceNumber, receiptUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      setSelected(null);
      toast({ title: "Payout updated!" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const saveConfigMutation = useMutation({
    mutationFn: (percentage: number) => apiRequest("PUT", "/api/admin/payout-config", { percentage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payout-config"] });
      toast({ title: "Payout percentage saved!" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const handleReceiptUpload = async (file: File) => {
    setUploadingReceipt(true);
    try {
      const url = await uploadReceiptToCloudinary(file);
      setReceiptUrl(url);
      toast({ title: "Receipt uploaded!" });
    } catch {
      toast({ title: "Receipt upload failed", variant: "destructive" });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const openDialog = (p: PayoutRow) => {
    setSelected(p);
    setAdminNotes(p.adminNotes ?? "");
    setRefNumber(p.referenceNumber ?? "");
    setReceiptUrl(p.receiptUrl ?? "");
  };

  const pending = payouts.filter(p => p.status === "pending");
  const processing = payouts.filter(p => p.status === "processing");
  const done = payouts.filter(p => p.status === "completed" || p.status === "rejected");

  const renderCard = (p: PayoutRow) => {
    const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
    const details = p.payoutDetails as Record<string, any> | null;
    const snapshots: BookingSnapshot[] = details?.bookingsSnapshot ?? [];
    const payoutPct: number = details?.payoutPct ?? 70;

    // totals from snapshot
    const totalGross = snapshots.reduce((s, b) => s + b.grossPaid, 0);
    const totalFee = snapshots.reduce((s, b) => s + b.platformFee, 0);

    return (
      <Card key={p.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold">{p.photographerName || "Unknown Photographer"}</span>
                <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                {p.payoutMethod && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <BanknoteIcon className="w-3 h-3" /> Bank Wire
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{p.photographerEmail}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.bookingIds.length} booking{p.bookingIds.length > 1 ? "s" : ""} · {new Date(p.requestedAt).toLocaleDateString()}
              </p>

              {/* Bank wire details */}
              {details?.bankName && (
                <div className="mt-2 p-2 bg-muted rounded text-xs space-y-0.5">
                  <p><strong>Bank:</strong> {details.bankName}{details.bankBranch ? ` · ${details.bankBranch}` : ""}</p>
                  {details.accountHolderName && <p><strong>Account:</strong> {details.accountHolderName}</p>}
                  {details.accountNumber && <p><strong>Acct #:</strong> {details.accountNumber}</p>}
                  {details.accountType && <p><strong>Type:</strong> {details.accountType}</p>}
                  {details.routingNumber && <p><strong>Routing:</strong> {details.routingNumber}</p>}
                  {details.swiftCode && <p><strong>SWIFT:</strong> {details.swiftCode}</p>}
                  {details.notes && <p className="italic">{details.notes}</p>}
                </div>
              )}

              {/* Connectagrapher fee breakdown (from snapshot) */}
              {snapshots.length > 0 && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-100 rounded text-xs space-y-1">
                  <p className="font-semibold text-blue-800 uppercase tracking-wide text-[10px] mb-1">Connectagrapher Fee Breakdown</p>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="font-normal pr-2">Client</th>
                        <th className="font-normal pr-2">Service</th>
                        <th className="font-normal text-right pr-2">Collected</th>
                        <th className="font-normal text-right pr-2">Fee ({100 - payoutPct}%)</th>
                        <th className="font-normal text-right">Payout ({payoutPct}%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map(b => (
                        <tr key={b.id} className="border-t border-blue-100">
                          <td className="pr-2 py-0.5 truncate max-w-[80px]">{b.clientName}</td>
                          <td className="pr-2 capitalize">{b.serviceType}</td>
                          <td className="text-right pr-2">{fmt(b.grossPaid, p.currency)}</td>
                          <td className="text-right pr-2 text-orange-700">−{fmt(b.platformFee, p.currency)}</td>
                          <td className="text-right text-green-700">{fmt(b.photographerCut, p.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-blue-200">
                      <tr className="font-semibold">
                        <td colSpan={2} className="pt-1">Total</td>
                        <td className="text-right pr-2">{fmt(totalGross, p.currency)}</td>
                        <td className="text-right pr-2 text-orange-700">−{fmt(totalFee, p.currency)}</td>
                        <td className="text-right text-green-700">{fmt(p.amount, p.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {p.referenceNumber && (
                <p className="text-xs text-muted-foreground mt-1">Ref: <span className="font-mono">{p.referenceNumber}</span></p>
              )}
              {p.adminNotes && (
                <p className="text-xs italic text-muted-foreground mt-1">"{p.adminNotes}"</p>
              )}
              {p.receiptUrl && (
                <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                  <ImageIcon className="w-3 h-3" /> View Bank Receipt <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-green-700">{formatAmount(p.amount, p.currency)}</p>
              {p.status !== "completed" && p.status !== "rejected" && (
                <Button size="sm" className="mt-2" onClick={() => openDialog(p)}>
                  Process
                </Button>
              )}
              {(p.status === "completed" || p.status === "rejected") && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => openDialog(p)}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="pending" className="text-xs sm:text-sm">
            Pending {pending.length > 0 && <span className="ml-1 bg-orange-100 text-orange-700 rounded-full px-1.5 text-xs">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="processing" className="text-xs sm:text-sm">
            Processing {processing.length > 0 && <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-1.5 text-xs">{processing.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs sm:text-sm">History</TabsTrigger>
          <TabsTrigger value="config" className="text-xs sm:text-sm">
            <Settings className="w-3 h-3 mr-1" /> Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {isLoading && <p className="text-center text-muted-foreground py-8">Loading...</p>}
          {!isLoading && pending.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No pending payout requests.</p>
          )}
          {pending.map(renderCard)}
        </TabsContent>

        <TabsContent value="processing" className="space-y-3 mt-4">
          {processing.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No payouts currently processing.</p>
          )}
          {processing.map(renderCard)}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          {done.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No completed payouts yet.</p>
          )}
          {done.map(renderCard)}
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Photographer Payout Percentage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 max-w-xs">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={payoutPctInput}
                  onChange={(e) => setPayoutPctInput(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">% of collected booking amount</span>
              </div>
              <p className="text-xs text-muted-foreground">
                e.g. a booking where J$10,000 was collected → photographer earns J${Math.round(10000 * payoutPctInput / 100).toLocaleString()} · platform keeps J${Math.round(10000 * (100 - payoutPctInput) / 100).toLocaleString()}
              </p>
              <Button
                onClick={() => saveConfigMutation.mutate(payoutPctInput)}
                disabled={saveConfigMutation.isPending}
              >
                {saveConfigMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Process Payout Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Payout — {selected && formatAmount(selected.amount, selected.currency)}</DialogTitle>
          </DialogHeader>

          {selected && (() => {
            const details = selected.payoutDetails as Record<string, any> | null;
            const snapshots: BookingSnapshot[] = details?.bookingsSnapshot ?? [];
            const payoutPct: number = details?.payoutPct ?? 70;
            const totalGross = snapshots.reduce((s, b) => s + b.grossPaid, 0);
            const totalFee = snapshots.reduce((s, b) => s + b.platformFee, 0);

            return (
              <div className="space-y-4">
                {/* Bank wire summary */}
                <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                  <p><strong>Photographer:</strong> {selected.photographerName}</p>
                  <p><strong>Method:</strong> Bank Wire</p>
                  {details?.bankName && <p><strong>Bank:</strong> {details.bankName}{details.bankBranch ? ` · ${details.bankBranch}` : ""}</p>}
                  {details?.accountHolderName && <p><strong>Account Holder:</strong> {details.accountHolderName}</p>}
                  {details?.accountNumber && <p><strong>Acct #:</strong> {details.accountNumber}</p>}
                  {details?.accountType && <p><strong>Type:</strong> {details.accountType}</p>}
                  {details?.routingNumber && <p><strong>Routing:</strong> {details.routingNumber}</p>}
                  {details?.swiftCode && <p><strong>SWIFT:</strong> {details.swiftCode}</p>}
                  {details?.currency && <p><strong>Preferred Currency:</strong> {details.currency}</p>}
                  {details?.notes && <p className="italic text-muted-foreground">{details.notes}</p>}
                </div>

                {/* Connectagrapher breakdown */}
                {snapshots.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                    <p className="font-semibold text-blue-800 text-xs uppercase tracking-wide mb-2">Connectagrapher Receipt Breakdown</p>
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
                          <div className="text-right space-y-0.5 shrink-0 pl-2">
                            <p className="text-muted-foreground">Collected: {fmt(b.grossPaid, selected.currency)}</p>
                            <p className="text-orange-700">Fee ({100 - payoutPct}%): −{fmt(b.platformFee, selected.currency)}</p>
                            <p className="font-semibold text-green-700">Payout: {fmt(b.photographerCut, selected.currency)}</p>
                          </div>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Total</span>
                        <div className="text-right">
                          <span className="text-muted-foreground mr-3">Collected: {fmt(totalGross, selected.currency)}</span>
                          <span className="text-orange-700 mr-3">Fee: −{fmt(totalFee, selected.currency)}</span>
                          <span className="text-green-700">Payout: {fmt(selected.amount, selected.currency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Reference Number</Label>
                  <Input
                    placeholder="Transaction / reference number"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Admin Notes (visible to photographer)</Label>
                  <Textarea
                    placeholder="Optional note..."
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  />
                </div>

                {/* Bank receipt upload */}
                <div className="space-y-1.5">
                  <Label>Bank Transfer Receipt (optional)</Label>
                  <input
                    ref={receiptFileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleReceiptUpload(f);
                    }}
                  />
                  {receiptUrl ? (
                    <div className="flex items-center gap-2">
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                        <ImageIcon className="w-4 h-4" /> View uploaded receipt <ExternalLink className="w-3 h-3" />
                      </a>
                      <Button size="sm" variant="ghost" className="text-xs h-6 px-2"
                        onClick={() => setReceiptUrl("")}>Remove</Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => receiptFileRef.current?.click()}
                      disabled={uploadingReceipt}
                    >
                      {uploadingReceipt
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
                        : <><Upload className="w-4 h-4 mr-2" /> Upload Receipt</>}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => selected && updateMutation.mutate({ id: selected.id, status: "rejected", adminNotes, receiptUrl: receiptUrl || undefined })}
              disabled={updateMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              variant="secondary"
              onClick={() => selected && updateMutation.mutate({ id: selected.id, status: "processing", adminNotes, referenceNumber: refNumber, receiptUrl: receiptUrl || undefined })}
              disabled={updateMutation.isPending}
            >
              <Clock className="w-4 h-4 mr-1" /> Mark Processing
            </Button>
            <Button
              onClick={() => selected && updateMutation.mutate({ id: selected.id, status: "completed", adminNotes, referenceNumber: refNumber, receiptUrl: receiptUrl || undefined })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
