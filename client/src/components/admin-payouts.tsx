import { useState } from "react";
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
import { BanknoteIcon, CreditCard, CheckCircle2, XCircle, Clock, Loader2, Settings } from "lucide-react";

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

export function AdminPayouts() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<PayoutRow | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [payoutPctInput, setPayoutPctInput] = useState<number>(70);

  const { data: payouts = [], isLoading } = useQuery<PayoutRow[]>({
    queryKey: ["/api/admin/payouts"],
  });

  const { data: payoutConfig } = useQuery<{ percentage: number }>({
    queryKey: ["/api/admin/payout-config"],
    onSuccess: (d) => setPayoutPctInput(d.percentage),
  } as any);

  const updateMutation = useMutation({
    mutationFn: ({ id, status, adminNotes, referenceNumber }: { id: string; status: string; adminNotes?: string; referenceNumber?: string }) =>
      apiRequest("PATCH", `/api/admin/payouts/${id}`, { status, adminNotes, referenceNumber }),
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

  const openDialog = (p: PayoutRow) => {
    setSelected(p);
    setAdminNotes(p.adminNotes ?? "");
    setRefNumber(p.referenceNumber ?? "");
  };

  const pending = payouts.filter(p => p.status === "pending");
  const processing = payouts.filter(p => p.status === "processing");
  const done = payouts.filter(p => p.status === "completed" || p.status === "rejected");

  const renderCard = (p: PayoutRow) => {
    const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
    const details = p.payoutDetails as Record<string, any> | null;
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
                    {p.payoutMethod === "bank" ? <BanknoteIcon className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                    {p.payoutMethod === "bank" ? "Bank Wire" : "Card Deposit"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{p.photographerEmail}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.bookingIds.length} booking{p.bookingIds.length > 1 ? "s" : ""} · {new Date(p.requestedAt).toLocaleDateString()}
              </p>

              {/* Payout Details */}
              {details?.method === "bank" && (
                <div className="mt-2 p-2 bg-muted rounded text-xs space-y-0.5">
                  {details.bankName && <p><strong>Bank:</strong> {details.bankName}{details.bankBranch ? ` · ${details.bankBranch}` : ""}</p>}
                  {details.accountHolderName && <p><strong>Account:</strong> {details.accountHolderName}</p>}
                  {details.accountNumber && <p><strong>Acct #:</strong> {details.accountNumber}</p>}
                  {details.routingNumber && <p><strong>Routing:</strong> {details.routingNumber}</p>}
                  {details.notes && <p className="italic">{details.notes}</p>}
                </div>
              )}
              {details?.method === "card" && (
                <div className="mt-2 p-2 bg-muted rounded text-xs space-y-0.5">
                  {details.cardHolderName && <p><strong>Cardholder:</strong> {details.cardHolderName}</p>}
                  {details.cardIssuingBank && <p><strong>Bank:</strong> {details.cardIssuingBank}</p>}
                  {details.cardType && details.cardNumber && <p><strong>Card:</strong> {details.cardType} ····{details.cardNumber}</p>}
                  {details.notes && <p className="italic">{details.notes}</p>}
                </div>
              )}

              {p.referenceNumber && (
                <p className="text-xs text-muted-foreground mt-1">Ref: <span className="font-mono">{p.referenceNumber}</span></p>
              )}
              {p.adminNotes && (
                <p className="text-xs italic text-muted-foreground mt-1">"{p.adminNotes}"</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-green-700">{formatAmount(p.amount, p.currency)}</p>
              {p.status !== "completed" && p.status !== "rejected" && (
                <Button size="sm" className="mt-2" onClick={() => openDialog(p)}>
                  Process
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Process Payout — {selected && formatAmount(selected.amount, selected.currency)}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p><strong>Photographer:</strong> {selected.photographerName}</p>
                <p><strong>Method:</strong> {selected.payoutMethod === "bank" ? "Bank Wire" : "Card Deposit"}</p>
                {selected.payoutDetails && Object.entries(selected.payoutDetails as Record<string, any>)
                  .filter(([k, v]) => k !== "method" && v)
                  .map(([k, v]) => (
                    <p key={k}><strong className="capitalize">{k.replace(/([A-Z])/g, ' $1')}:</strong> {String(v)}</p>
                  ))}
              </div>

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
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => selected && updateMutation.mutate({ id: selected.id, status: "rejected", adminNotes })}
              disabled={updateMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              variant="secondary"
              onClick={() => selected && updateMutation.mutate({ id: selected.id, status: "processing", adminNotes, referenceNumber: refNumber })}
              disabled={updateMutation.isPending}
            >
              <Clock className="w-4 h-4 mr-1" /> Mark Processing
            </Button>
            <Button
              onClick={() => selected && updateMutation.mutate({ id: selected.id, status: "completed", adminNotes, referenceNumber: refNumber })}
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
