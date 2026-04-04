import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash, PencilSimple, Tag, Ticket, X } from "@phosphor-icons/react";

export interface PromotionPackage {
  tier: string;
  price: number;
  currency: string;
  features: string[];
}

export interface PromotionAddon {
  name: string;
  price: number;
  currency: string;
  description: string;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string;
  imageUrl: string | null;
  packages: PromotionPackage[];
  addons: PromotionAddon[];
  validFrom: string | null;
  validUntil: string | null;
  terms: string | null;
  isActive: boolean;
  createdAt: string;
}

const BADGES = [
  { value: "deal", label: "Deal", color: "bg-blue-500" },
  { value: "new", label: "New", color: "bg-emerald-500" },
  { value: "sale", label: "Sale", color: "bg-red-500" },
  { value: "special", label: "Special", color: "bg-amber-500" },
  { value: "seasonal", label: "Seasonal", color: "bg-purple-500" },
  { value: "hot", label: "Hot", color: "bg-orange-500" },
];

const badgeColor = (badge: string) => BADGES.find(b => b.value === badge)?.color ?? "bg-amber-500";

function emptyPackage(): PromotionPackage {
  return { tier: "", price: 0, currency: "USD", features: [""] };
}

function emptyAddon(): PromotionAddon {
  return { name: "", price: 0, currency: "USD", description: "" };
}

function emptyForm() {
  return {
    title: "",
    subtitle: "",
    badge: "special",
    imageUrl: "",
    packages: [emptyPackage()] as PromotionPackage[],
    addons: [] as PromotionAddon[],
    validFrom: "",
    validUntil: "",
    terms: "",
    isActive: true,
  };
}

export function AdminPromotions() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/admin/promotions"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/promotions", data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] }); toast({ title: "Promotion created" }); closeDialog(); },
    onError: () => toast({ title: "Failed to create promotion", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/admin/promotions/${id}`, data).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] }); toast({ title: "Promotion updated" }); closeDialog(); },
    onError: () => toast({ title: "Failed to update promotion", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/promotions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] }); toast({ title: "Promotion deleted" }); },
    onError: () => toast({ title: "Failed to delete promotion", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PUT", `/api/admin/promotions/${id}`, { isActive }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] }),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm());
  }

  function openCreate() {
    setForm(emptyForm());
    setEditId(null);
    setDialogOpen(true);
  }

  function openEdit(p: Promotion) {
    setForm({
      title: p.title,
      subtitle: p.subtitle ?? "",
      badge: p.badge,
      imageUrl: p.imageUrl ?? "",
      packages: p.packages.length ? p.packages.map(pkg => ({
        ...pkg,
        features: pkg.features.length ? pkg.features : [""],
      })) : [emptyPackage()],
      addons: p.addons ?? [],
      validFrom: p.validFrom ? p.validFrom.slice(0, 10) : "",
      validUntil: p.validUntil ? p.validUntil.slice(0, 10) : "",
      terms: p.terms ?? "",
      isActive: p.isActive,
    });
    setEditId(p.id);
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      ...form,
      subtitle: form.subtitle || null,
      imageUrl: form.imageUrl || null,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
      terms: form.terms || null,
      packages: form.packages.map(pkg => ({
        ...pkg,
        features: pkg.features.filter(f => f.trim()),
      })).filter(pkg => pkg.tier.trim()),
      addons: form.addons.filter(a => a.name.trim()),
    };
    if (editId) updateMutation.mutate({ id: editId, data: payload });
    else createMutation.mutate(payload);
  }

  // ── Package helpers ──────────────────────────────────────────────────────
  function setPackage(i: number, key: keyof PromotionPackage, value: any) {
    setForm(f => {
      const pkgs = [...f.packages];
      pkgs[i] = { ...pkgs[i], [key]: value };
      return { ...f, packages: pkgs };
    });
  }

  function setFeature(pi: number, fi: number, value: string) {
    setForm(f => {
      const pkgs = [...f.packages];
      const features = [...pkgs[pi].features];
      features[fi] = value;
      pkgs[pi] = { ...pkgs[pi], features };
      return { ...f, packages: pkgs };
    });
  }

  function addFeature(pi: number) {
    setForm(f => {
      const pkgs = [...f.packages];
      pkgs[pi] = { ...pkgs[pi], features: [...pkgs[pi].features, ""] };
      return { ...f, packages: pkgs };
    });
  }

  function removeFeature(pi: number, fi: number) {
    setForm(f => {
      const pkgs = [...f.packages];
      pkgs[pi] = { ...pkgs[pi], features: pkgs[pi].features.filter((_, i) => i !== fi) };
      return { ...f, packages: pkgs };
    });
  }

  function addPackage() {
    setForm(f => ({ ...f, packages: [...f.packages, emptyPackage()] }));
  }

  function removePackage(i: number) {
    setForm(f => ({ ...f, packages: f.packages.filter((_, idx) => idx !== i) }));
  }

  // ── Addon helpers ────────────────────────────────────────────────────────
  function setAddon(i: number, key: keyof PromotionAddon, value: any) {
    setForm(f => {
      const addons = [...f.addons];
      addons[i] = { ...addons[i], [key]: value };
      return { ...f, addons };
    });
  }

  function addAddon() {
    setForm(f => ({ ...f, addons: [...f.addons, emptyAddon()] }));
  }

  function removeAddon(i: number) {
    setForm(f => ({ ...f, addons: f.addons.filter((_, idx) => idx !== i) }));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Seasonal Specials & Deals</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Create promotional offers that appear on the home page.</p>
        </div>
        <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
          <Plus size={16} className="mr-1.5" /> New Special
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Ticket size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No promotions yet</p>
            <p className="text-xs mt-1">Create your first seasonal special or deal.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {promotions.map(p => {
            const now = new Date();
            const expired = p.validUntil && new Date(p.validUntil) < now;
            const upcoming = p.validFrom && new Date(p.validFrom) > now;
            return (
              <Card key={p.id} className={`border ${!p.isActive || expired ? "opacity-60" : ""}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt={p.title} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white ${badgeColor(p.badge)}`}>
                        {p.badge}
                      </span>
                      <span className="font-semibold text-sm">{p.title}</span>
                      {p.subtitle && <span className="text-xs text-muted-foreground">{p.subtitle}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(p.packages ?? []).map((pkg, i) => (
                        <span key={i} className="text-[11px] bg-muted rounded px-1.5 py-0.5">
                          {pkg.tier} ${pkg.price}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 flex flex-wrap gap-3">
                      {p.validFrom && <span>From: {new Date(p.validFrom).toLocaleDateString()}</span>}
                      {p.validUntil && <span>Until: {new Date(p.validUntil).toLocaleDateString()}</span>}
                      {expired && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Expired</Badge>}
                      {upcoming && <Badge className="text-[10px] px-1.5 py-0 bg-blue-500">Upcoming</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={p.isActive}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, isActive: v })}
                    />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <PencilSimple size={15} />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Delete this promotion?")) deleteMutation.mutate(p.id); }}
                    >
                      <Trash size={15} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Promotion" : "New Promotion"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Carnival Photoshoot"
                />
              </div>
              <div>
                <Label>Subtitle / tagline</Label>
                <Input
                  value={form.subtitle}
                  onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                  placeholder="e.g. Ready For Your..."
                />
              </div>
              <div>
                <Label>Badge</Label>
                <Select value={form.badge} onValueChange={v => setForm(f => ({ ...f, badge: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BADGES.map(b => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Image */}
            <div>
              <Label>Promo Image URL (optional)</Label>
              <Input
                value={form.imageUrl}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
              {form.imageUrl && (
                <img src={form.imageUrl} alt="preview" className="mt-2 h-24 w-auto rounded object-cover" />
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valid From</Label>
                <Input type="date" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
              </div>
            </div>

            {/* Packages */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Packages</Label>
                <Button type="button" size="sm" variant="outline" onClick={addPackage}>
                  <Plus size={13} className="mr-1" /> Add Package
                </Button>
              </div>
              <div className="space-y-4">
                {form.packages.map((pkg, pi) => (
                  <div key={pi} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Input
                        value={pkg.tier}
                        onChange={e => setPackage(pi, "tier", e.target.value)}
                        placeholder="Tier name (e.g. Bronze)"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={pkg.price}
                        onChange={e => setPackage(pi, "price", Number(e.target.value))}
                        placeholder="Price"
                        className="w-24"
                      />
                      <Select value={pkg.currency} onValueChange={v => setPackage(pi, "currency", v)}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="JMD">JMD</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.packages.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removePackage(pi)}>
                          <X size={14} />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Features</Label>
                      {pkg.features.map((f, fi) => (
                        <div key={fi} className="flex gap-1.5">
                          <Input
                            value={f}
                            onChange={e => setFeature(pi, fi, e.target.value)}
                            placeholder="e.g. 10 Edited Photos"
                            className="text-sm"
                          />
                          {pkg.features.length > 1 && (
                            <Button type="button" size="icon" variant="ghost" onClick={() => removeFeature(pi, fi)}>
                              <X size={13} />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => addFeature(pi)}>
                        <Plus size={12} className="mr-1" /> Add feature
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add-ons */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Add-ons / Upgrades</Label>
                <Button type="button" size="sm" variant="outline" onClick={addAddon}>
                  <Plus size={13} className="mr-1" /> Add Upgrade
                </Button>
              </div>
              {form.addons.length === 0 && (
                <p className="text-xs text-muted-foreground">No add-ons yet.</p>
              )}
              <div className="space-y-2">
                {form.addons.map((addon, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="flex gap-2">
                      <Input
                        value={addon.name}
                        onChange={e => setAddon(i, "name", e.target.value)}
                        placeholder="Upgrade name"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        value={addon.price}
                        onChange={e => setAddon(i, "price", Number(e.target.value))}
                        placeholder="Price"
                        className="w-24"
                      />
                      <Select value={addon.currency} onValueChange={v => setAddon(i, "currency", v)}>
                        <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="JMD">JMD</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeAddon(i)}>
                        <X size={14} />
                      </Button>
                    </div>
                    <Input
                      value={addon.description}
                      onChange={e => setAddon(i, "description", e.target.value)}
                      placeholder="Description (e.g. Applicable to all packages)"
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Terms */}
            <div>
              <Label>Terms / Fine print</Label>
              <Input
                value={form.terms}
                onChange={e => setForm(f => ({ ...f, terms: e.target.value }))}
                placeholder="e.g. 50% deposit | Limited slots | Conditions apply"
              />
            </div>

            {/* Active */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
              />
              <Label>Active (visible on site)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || !form.title.trim()} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold">
              {isSaving ? "Saving..." : editId ? "Save Changes" : "Create Promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
