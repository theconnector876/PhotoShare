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
    </div>
  );
}
