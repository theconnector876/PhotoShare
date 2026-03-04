import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { defaultPricingConfig, type PricingConfig } from "@shared/pricing";
import { SUPPORTED_CURRENCIES, CURRENCY_NAMES, CURRENCY_SYMBOLS, type Currency } from "@shared/currency";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Copy, ToggleLeft, ToggleRight, Link as LinkIcon } from "lucide-react";
import type { CustomPackage } from "@shared/schema";

const TIERS = ["bronze", "silver", "gold", "platinum"] as const;
type Tier = (typeof TIERS)[number];

const TIER_STYLE: Record<Tier, string> = {
  bronze:   "border-orange-300 bg-orange-50 text-orange-700",
  silver:   "border-gray-300 bg-gray-50 text-gray-600",
  gold:     "border-yellow-300 bg-yellow-50 text-yellow-700",
  platinum: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

// Number field with optional unit prefix
function NumField({
  label,
  value,
  onChange,
  unit = "$",
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground w-4 shrink-0">{unit}</span>
        <Input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          className="h-8 text-sm"
        />
      </div>
    </div>
  );
}

export function AdminPricing() {
  const { toast } = useToast();
  const [pricing, setPricing] = useState<PricingConfig>(defaultPricingConfig);

  const { data } = useQuery({ queryKey: ["/api/pricing"], retry: false });

  useEffect(() => {
    if (data) setPricing(data as PricingConfig);
  }, [data]);

  const updatePricingMutation = useMutation({
    mutationFn: async (config: PricingConfig) => {
      await apiRequest("PUT", "/api/admin/pricing", { config });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing"] });
      toast({ title: "Pricing Updated", description: "Global pricing configuration saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update pricing.", variant: "destructive" });
    },
  });

  // Deep-set helper
  const set = (path: string, value: unknown) => {
    setPricing((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as PricingConfig;
      const keys = path.split(".");
      let cur: any = next;
      keys.slice(0, -1).forEach((k) => (cur = cur[k]));
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Currency selector */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <Label className="text-sm font-medium shrink-0">Pricing Currency</Label>
          <Select
            value={pricing.currency ?? 'USD'}
            onValueChange={(v) => set("currency", v as Currency)}
          >
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.filter(c => c === 'USD' || c === 'JMD').map(c => (
                <SelectItem key={c} value={c}>
                  {CURRENCY_SYMBOLS[c]} {CURRENCY_NAMES[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Determines the currency shown in the booking calculator and charged at payment.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="photoshoot">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="photoshoot" className="text-xs sm:text-sm">Photoshoot</TabsTrigger>
          <TabsTrigger value="wedding" className="text-xs sm:text-sm">Wedding</TabsTrigger>
          <TabsTrigger value="events" className="text-xs sm:text-sm">Events</TabsTrigger>
          <TabsTrigger value="addons" className="text-xs sm:text-sm">Add-ons</TabsTrigger>
          <TabsTrigger value="fees" className="text-xs sm:text-sm">Fees</TabsTrigger>
        </TabsList>

        {/* ── PHOTOSHOOT ──────────────────────────────────── */}
        <TabsContent value="photoshoot" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Photography Packages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {TIERS.map((tier) => (
                  <div key={tier} className={`rounded-lg border-2 p-3 space-y-3 ${TIER_STYLE[tier]}`}>
                    <p className="font-bold capitalize text-sm">{tier}</p>
                    <NumField
                      label="Price"
                      value={pricing.packages.photoshoot.photography[tier].price}
                      onChange={(v) => set(`packages.photoshoot.photography.${tier}.price`, v)}
                    />
                    <NumField
                      label="Duration (min)"
                      value={pricing.packages.photoshoot.photography[tier].duration}
                      onChange={(v) => set(`packages.photoshoot.photography.${tier}.duration`, v)}
                      unit="⏱"
                    />
                    <NumField
                      label="Images"
                      value={pricing.packages.photoshoot.photography[tier].images}
                      onChange={(v) => set(`packages.photoshoot.photography.${tier}.images`, v)}
                      unit="🖼"
                    />
                    <NumField
                      label="Locations"
                      value={pricing.packages.photoshoot.photography[tier].locations}
                      onChange={(v) => set(`packages.photoshoot.photography.${tier}.locations`, v)}
                      unit="📍"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Videography Add-on (per tier)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {TIERS.map((tier) => (
                  <div key={tier} className={`rounded-lg border-2 p-3 ${TIER_STYLE[tier]}`}>
                    <p className="font-bold capitalize text-sm mb-3">{tier}</p>
                    <NumField
                      label="Price"
                      value={pricing.packages.photoshoot.videography[tier]}
                      onChange={(v) => set(`packages.photoshoot.videography.${tier}`, v)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── WEDDING ─────────────────────────────────────── */}
        <TabsContent value="wedding" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Photography Packages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {TIERS.map((tier) => (
                  <div key={tier} className={`rounded-lg border-2 p-3 ${TIER_STYLE[tier]}`}>
                    <p className="font-bold capitalize text-sm mb-3">{tier}</p>
                    <NumField
                      label="Price"
                      value={pricing.packages.wedding.photography[tier]}
                      onChange={(v) => set(`packages.wedding.photography.${tier}`, v)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Videography Packages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {TIERS.map((tier) => (
                  <div key={tier} className={`rounded-lg border-2 p-3 ${TIER_STYLE[tier]}`}>
                    <p className="font-bold capitalize text-sm mb-3">{tier}</p>
                    <NumField
                      label="Price"
                      value={pricing.packages.wedding.videography[tier]}
                      onChange={(v) => set(`packages.wedding.videography.${tier}`, v)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── EVENTS ──────────────────────────────────────── */}
        <TabsContent value="events" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Photography (Hourly)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NumField
                  label="Base Rate (per hour)"
                  value={pricing.packages.event.photography.baseRate}
                  onChange={(v) => set("packages.event.photography.baseRate", v)}
                />
                <NumField
                  label="Minimum Hours"
                  value={pricing.packages.event.photography.minimumHours}
                  onChange={(v) => set("packages.event.photography.minimumHours", v)}
                  unit="⏱"
                  min={1}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Videography (Hourly)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NumField
                  label="Base Rate (per hour)"
                  value={pricing.packages.event.videography.baseRate}
                  onChange={(v) => set("packages.event.videography.baseRate", v)}
                />
                <NumField
                  label="Minimum Hours"
                  value={pricing.packages.event.videography.minimumHours}
                  onChange={(v) => set("packages.event.videography.minimumHours", v)}
                  unit="⏱"
                  min={1}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── ADD-ONS ─────────────────────────────────────── */}
        <TabsContent value="addons" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Add-on Prices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Highlight Reel", path: "addons.highlightReel" },
                  { label: "Express Delivery", path: "addons.expressDelivery" },
                  { label: "Drone (Photoshoot)", path: "addons.dronePhotoshoot" },
                  { label: "Drone (Wedding)", path: "addons.droneWedding" },
                  { label: "Studio Rental", path: "addons.studioRental" },
                  { label: "Flying Dress", path: "addons.flyingDress" },
                  { label: "Clear Kayak", path: "addons.clearKayak" },
                ].map(({ label, path }) => {
                  const val = path.split(".").reduce((o: any, k) => o[k], pricing) as number;
                  return (
                    <NumField key={path} label={label} value={val} onChange={(v) => set(path, v)} />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FEES ────────────────────────────────────────── */}
        <TabsContent value="fees" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">General</CardTitle>
              </CardHeader>
              <CardContent>
                <NumField
                  label="Additional Person"
                  value={pricing.fees.additionalPerson}
                  onChange={(v) => set("fees.additionalPerson", v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Transportation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <NumField
                  label="Manchester / St. Elizabeth"
                  value={pricing.fees.transportation.manchesterStElizabeth}
                  onChange={(v) => set("fees.transportation.manchesterStElizabeth", v)}
                />
                <Separator />
                <NumField
                  label="Montego Bay / Negril / Ocho Rios"
                  value={pricing.fees.transportation.montegoBayNegrilOchoRios}
                  onChange={(v) => set("fees.transportation.montegoBayNegrilOchoRios", v)}
                />
                <Separator />
                <NumField
                  label="Other Parishes"
                  value={pricing.fees.transportation.otherParishes}
                  onChange={(v) => set("fees.transportation.otherParishes", v)}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => updatePricingMutation.mutate(pricing)}
          disabled={updatePricingMutation.isPending}
          className="min-w-32"
        >
          {updatePricingMutation.isPending ? "Saving…" : "Save Pricing"}
        </Button>
      </div>

      <CustomPackagesSection />
    </div>
  );
}

// ── Custom Private Packages ──────────────────────────────────────────────────
interface LineItem { name: string; price: string; } // price as display string (dollars)

interface NewPkgForm {
  name: string;
  description: string;
  serviceType: string;
  serviceTypeOther: string;
  items: LineItem[];      // line items with individual prices
  depositAmount: string;  // deposit in dollars (0 = 50% auto-split)
  currency: string;
}

const EMPTY_FORM: NewPkgForm = {
  name: "", description: "", serviceType: "photoshoot", serviceTypeOther: "",
  items: [{ name: "", price: "" }], depositAmount: "", currency: "USD",
};

function CustomPackagesSection({ apiBase = "/api/admin/custom-packages", queryKey = "/api/admin/custom-packages" }: { apiBase?: string; queryKey?: string }) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewPkgForm>(EMPTY_FORM);

  const { data: packages = [] } = useQuery<CustomPackage[]>({
    queryKey: [queryKey],
    queryFn: async () => (await apiRequest("GET", apiBase)).json(),
  });

  const resolvedServiceType = form.serviceType === "other" ? form.serviceTypeOther.trim() : form.serviceType;

  // Compute total from line items (sum of non-empty prices)
  const computedTotal = form.items.reduce((sum, it) => {
    const v = parseFloat(it.price);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const lineItemsForApi = form.items
    .filter(it => it.name.trim())
    .map(it => ({ name: it.name.trim(), price: Math.round((parseFloat(it.price) || 0) * 100) }));

  const createMutation = useMutation({
    mutationFn: async () => {
      const totalCents = Math.round(computedTotal * 100);
      if (totalCents <= 0) throw new Error("Add at least one item with a price");
      const res = await apiRequest("POST", apiBase, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        serviceType: resolvedServiceType,
        totalPrice: totalCents,
        depositAmount: Math.round(parseFloat(form.depositAmount || "0") * 100),
        currency: form.currency,
        lineItems: lineItemsForApi,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: "Package created" });
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `${apiBase}/${id}`, { isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    onError: () => toast({ title: "Failed to update package", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiBase}/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: "Package deleted" });
    },
    onError: () => toast({ title: "Failed to delete package", variant: "destructive" }),
  });

  const copyLink = (pkg: CustomPackage) => {
    const url = `${window.location.origin}/booking?pkg=${pkg.id}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Link copied!" }));
  };

  const canSubmit = form.name.trim() && resolvedServiceType && computedTotal > 0;

  const setItem = (idx: number, field: keyof LineItem, value: string) =>
    setForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], [field]: value }; return { ...p, items }; });
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { name: "", price: "" }] }));
  const removeItem = (idx: number) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const sym = CURRENCY_SYMBOLS[form.currency as keyof typeof CURRENCY_SYMBOLS] ?? "$";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Custom Private Packages</CardTitle>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" />New Package
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            One-off packages not shown publicly. Share via unique booking link.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No custom packages yet.</p>
          ) : (
            packages.map(pkg => {
              const items = (pkg as any).lineItems as Array<{name: string; price: number}> | undefined;
              return (
                <div key={pkg.id} className={`border rounded-lg p-3 flex items-start gap-3 ${!pkg.isActive ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{pkg.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{pkg.serviceType}</Badge>
                      <Badge variant={pkg.isActive ? "default" : "secondary"} className="text-xs">
                        {pkg.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-sm font-medium text-primary">
                        {pkg.currency} {((pkg.totalPrice ?? 0) / 100).toLocaleString()}
                      </span>
                    </div>
                    {pkg.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{pkg.description}</p>}
                    {items && items.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {items.map((it, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            · {it.name}{it.price > 0 ? ` — ${pkg.currency} ${(it.price / 100).toLocaleString()}` : " — Included"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Copy booking link" onClick={() => copyLink(pkg)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7"
                      title={pkg.isActive ? "Deactivate" : "Activate"}
                      onClick={() => toggleMutation.mutate({ id: pkg.id, isActive: !pkg.isActive })}
                      disabled={toggleMutation.isPending}
                    >
                      {pkg.isActive ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600"
                      title="Delete"
                      onClick={() => deleteMutation.mutate(pkg.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) { setShowCreate(false); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Custom Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Name + description */}
            <div>
              <Label className="text-xs">Package name *</Label>
              <Input className="mt-1 h-8 text-sm" placeholder="e.g. VIP Maternity Session"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea className="mt-1 text-sm resize-none" rows={2}
                placeholder="Shown to the client on the booking page"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            {/* Service type + currency */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Service type *</Label>
                <Select value={form.serviceType} onValueChange={v => setForm(p => ({ ...p, serviceType: v, serviceTypeOther: "" }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photoshoot">Photoshoot</SelectItem>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="other">Other…</SelectItem>
                  </SelectContent>
                </Select>
                {form.serviceType === "other" && (
                  <Input className="mt-1.5 h-8 text-sm" placeholder="e.g. Maternity, Newborn…"
                    value={form.serviceTypeOther} onChange={e => setForm(p => ({ ...p, serviceTypeOther: e.target.value }))} />
                )}
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.filter(c => c === 'USD' || c === 'JMD').map(c => (
                      <SelectItem key={c} value={c}>{CURRENCY_SYMBOLS[c]} {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line items */}
            <div>
              <Label className="text-xs">What's included *</Label>
              <p className="text-[11px] text-muted-foreground mb-2">Add each item with its price. Leave price blank or 0 to show "Included".</p>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="h-8 text-sm flex-1"
                      placeholder="e.g. 2-hour session"
                      value={item.name}
                      onChange={e => setItem(idx, "name", e.target.value)}
                    />
                    <div className="flex items-center gap-1 w-28 shrink-0">
                      <span className="text-sm text-muted-foreground">{sym}</span>
                      <Input
                        type="number" min={0} step="0.01"
                        className="h-8 text-sm"
                        placeholder="0.00"
                        value={item.price}
                        onChange={e => setItem(idx, "price", e.target.value)}
                      />
                    </div>
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-red-500 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={addItem}>
                <Plus className="w-3 h-3 mr-1" />Add item
              </Button>
              {computedTotal > 0 && (
                <p className="text-sm font-medium mt-2">
                  Total: {sym}{computedTotal.toFixed(2)} {form.currency}
                </p>
              )}
            </div>

            {/* Deposit */}
            <div className="max-w-[180px]">
              <Label className="text-xs">Deposit amount (optional)</Label>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-sm text-muted-foreground">{sym}</span>
                <Input type="number" min={0} step="0.01" className="h-8 text-sm"
                  placeholder={computedTotal > 0 ? `${(computedTotal * 0.5).toFixed(2)} (50%)` : "0.00"}
                  value={form.depositAmount}
                  onChange={e => setForm(p => ({ ...p, depositAmount: e.target.value }))} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Leave blank to auto-split 50%</p>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button size="sm" disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating…" : "Create Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
