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
interface NewPkgForm {
  name: string;
  description: string;
  serviceType: string;   // "photoshoot" | "wedding" | "event" | "other"
  serviceTypeOther: string; // free-text when serviceType === "other"
  totalPrice: string;
  depositAmount: string;
  currency: string;
}

const EMPTY_FORM: NewPkgForm = {
  name: "", description: "", serviceType: "photoshoot", serviceTypeOther: "",
  totalPrice: "", depositAmount: "0", currency: "USD",
};

function CustomPackagesSection() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewPkgForm>(EMPTY_FORM);

  const { data: packages = [] } = useQuery<CustomPackage[]>({
    queryKey: ["/api/admin/custom-packages"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/custom-packages")).json(),
  });

  const resolvedServiceType = form.serviceType === "other" ? form.serviceTypeOther.trim() : form.serviceType;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/custom-packages", {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        serviceType: resolvedServiceType,
        totalPrice: Math.round(parseFloat(form.totalPrice) * 100),
        depositAmount: Math.round(parseFloat(form.depositAmount || "0") * 100),
        currency: form.currency,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-packages"] });
      toast({ title: "Package created" });
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/custom-packages/${id}`, { isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-packages"] }),
    onError: () => toast({ title: "Failed to update package", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/custom-packages/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/custom-packages"] });
      toast({ title: "Package deleted" });
    },
    onError: () => toast({ title: "Failed to delete package", variant: "destructive" }),
  });

  const bookingBaseUrl = `${window.location.origin}/booking`;
  const copyLink = (pkg: CustomPackage) => {
    const url = `${bookingBaseUrl}?pkg=${pkg.id}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied!" });
  };

  const canSubmit = form.name.trim() && resolvedServiceType && parseFloat(form.totalPrice) > 0;

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
            packages.map(pkg => (
              <div key={pkg.id} className={`border rounded-lg p-3 flex items-start gap-3 ${!pkg.isActive ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{pkg.name}</span>
                    <Badge variant="outline" className="text-xs">{pkg.serviceType}</Badge>
                    <Badge variant={pkg.isActive ? "default" : "secondary"} className="text-xs">
                      {pkg.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {pkg.currency} {((pkg.totalPrice ?? 0) / 100).toLocaleString()}
                    </span>
                  </div>
                  {pkg.description && <p className="text-xs text-muted-foreground mt-1 truncate">{pkg.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Copy booking link" onClick={() => copyLink(pkg)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title={pkg.isActive ? "Deactivate" : "Activate"}
                    onClick={() => toggleMutation.mutate({ id: pkg.id, isActive: !pkg.isActive })}
                    disabled={toggleMutation.isPending}
                  >
                    {pkg.isActive ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    title="Delete"
                    onClick={() => deleteMutation.mutate(pkg.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) { setShowCreate(false); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Custom Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Package name *</Label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="e.g. VIP Maternity Session"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Description (optional)</Label>
              <Textarea
                className="mt-1 text-sm resize-none"
                rows={2}
                placeholder="Brief description shown on the booking page"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
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
                  <Input
                    className="mt-1.5 h-8 text-sm"
                    placeholder="e.g. Maternity, Newborn…"
                    value={form.serviceTypeOther}
                    onChange={e => setForm(p => ({ ...p, serviceTypeOther: e.target.value }))}
                  />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Total price *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 h-8 text-sm"
                  placeholder="0.00"
                  value={form.totalPrice}
                  onChange={e => setForm(p => ({ ...p, totalPrice: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Deposit amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 h-8 text-sm"
                  placeholder="0.00"
                  value={form.depositAmount}
                  onChange={e => setForm(p => ({ ...p, depositAmount: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
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
