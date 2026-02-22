import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Tag, Check, X } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
  description: string | null;
  createdAt: string;
}

const emptyForm = () => ({
  code: "",
  discountType: "percentage" as "percentage" | "fixed",
  discountValue: 10,
  isActive: true,
  usageLimit: "" as string | number,
  expiresAt: "",
  description: "",
});

export function AdminCoupons() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/coupons", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] }); toast({ title: "Coupon created" }); closeDialog(); },
    onError: () => toast({ title: "Failed to create coupon", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/admin/coupons/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] }); toast({ title: "Coupon updated" }); closeDialog(); },
    onError: () => toast({ title: "Failed to update coupon", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/coupons/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] }); toast({ title: "Coupon deleted" }); },
    onError: () => toast({ title: "Failed to delete coupon", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PUT", `/api/admin/coupons/${id}`, { isActive }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] }),
  });

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(c: Coupon) {
    setEditId(c.id);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      isActive: c.isActive,
      usageLimit: c.usageLimit ?? "",
      expiresAt: c.expiresAt ? c.expiresAt.split("T")[0] : "",
      description: c.description ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm());
  }

  function handleSubmit() {
    const payload = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      isActive: form.isActive,
      usageLimit: form.usageLimit === "" || form.usageLimit === null ? null : Number(form.usageLimit),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      description: form.description || null,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function formatExpiry(val: string | null) {
    if (!val) return "—";
    const d = new Date(val);
    return d < new Date() ? <span className="text-red-500">Expired {d.toLocaleDateString()}</span> : d.toLocaleDateString();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Coupon Codes</h2>
          <p className="text-sm text-muted-foreground">Create and manage discount coupons for bookings</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Coupon
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading coupons…</div>
      ) : coupons.length === 0 ? (
        <Card className="p-12 text-center">
          <Tag className="mx-auto mb-4 w-10 h-10 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No coupons yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first coupon to offer discounts on bookings.</p>
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Create Coupon</Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {coupons.map((c) => {
            const expired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
            const limitHit = c.usageLimit !== null && c.usageCount >= c.usageLimit;
            const effective = c.isActive && !expired && !limitHit;
            return (
              <Card key={c.id} className={`p-4 ${!effective ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-lg">{c.code}</span>
                      <Badge variant={effective ? "default" : "secondary"}>
                        {effective ? "Active" : expired ? "Expired" : limitHit ? "Limit reached" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">
                        {c.discountType === "percentage" ? `${c.discountValue}% off` : `$${c.discountValue} off`}
                      </Badge>
                    </div>
                    {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span>Used: {c.usageCount}{c.usageLimit !== null ? `/${c.usageLimit}` : ""}</span>
                      <span>Expires: {formatExpiry(c.expiresAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={c.isActive}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, isActive: v })}
                    />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm(`Delete coupon "${c.code}"?`)) deleteMutation.mutate(c.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Coupon" : "New Coupon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Code *</Label>
              <Input
                className="font-mono uppercase mt-1"
                placeholder="e.g. SUMMER20"
                value={form.code}
                onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                disabled={!!editId}
              />
              {editId && <p className="text-xs text-muted-foreground mt-1">Code cannot be changed after creation.</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Type *</Label>
                <Select value={form.discountType} onValueChange={(v: "percentage" | "fixed") => setForm(f => ({ ...f, discountType: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value *</Label>
                <Input
                  type="number"
                  min={1}
                  max={form.discountType === "percentage" ? 100 : undefined}
                  value={form.discountValue}
                  onChange={(e) => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Usage Limit</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={form.usageLimit}
                  onChange={(e) => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Description (shown to client)</Label>
              <Input
                placeholder="e.g. Summer promotion — 20% off"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))}
              />
              <Label className="cursor-pointer">Active (can be used immediately)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.code.trim() || form.discountValue <= 0 || createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving…" : editId ? "Save Changes" : "Create Coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
