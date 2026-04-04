import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarBlank, CheckCircle, Star, Ticket } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import type { Promotion, PromotionPackage, PromotionAddon } from "@/components/admin-promotions";

const BADGE_COLORS: Record<string, string> = {
  deal: "bg-blue-500",
  new: "bg-emerald-500",
  sale: "bg-red-500",
  special: "bg-amber-500",
  seasonal: "bg-purple-500",
  hot: "bg-orange-500",
};

const TIER_GRADIENTS: Record<string, string> = {
  bronze:   "from-amber-700 to-amber-900",
  silver:   "from-slate-400 to-slate-600",
  gold:     "from-amber-400 to-amber-600",
  platinum: "from-slate-300 to-slate-500",
};

function tierGradient(tier: string) {
  return TIER_GRADIENTS[tier.toLowerCase()] ?? "from-zinc-600 to-zinc-800";
}

export default function PromotionPage() {
  const { id } = useParams<{ id: string }>();

  const { data: promo, isLoading, error } = useQuery<Promotion>({
    queryKey: ["/api/promotions", id],
    queryFn: async () => {
      const res = await fetch(`/api/promotions/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !promo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Ticket size={48} className="text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Promotion not found or no longer available.</p>
        <Link href="/">
          <Button variant="outline"><ArrowLeft size={16} className="mr-2" /> Go Home</Button>
        </Link>
      </div>
    );
  }

  const badgeColor = BADGE_COLORS[promo.badge] ?? "bg-amber-500";

  const validUntil = promo.validUntil ? new Date(promo.validUntil) : null;
  const validFrom  = promo.validFrom  ? new Date(promo.validFrom)  : null;
  const now = new Date();
  const expired = validUntil && validUntil < now;

  return (
    <>
      <Helmet>
        <title>{promo.title} | ConnectAGrapher</title>
        <meta name="description" content={promo.subtitle ?? promo.title} />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero banner */}
        <div className="relative overflow-hidden bg-zinc-900">
          {promo.imageUrl && (
            <img
              src={promo.imageUrl}
              alt={promo.title}
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-zinc-900" />

          <div className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-16 text-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="absolute top-4 left-4 text-white/70 hover:text-white">
                <ArrowLeft size={16} className="mr-1" /> Back
              </Button>
            </Link>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className={`inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white mb-4 ${badgeColor}`}>
                {promo.badge}
              </span>
              {promo.subtitle && (
                <p className="text-white/70 text-lg mb-1">{promo.subtitle}</p>
              )}
              <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-4">
                {promo.title}
              </h1>
              {(validFrom || validUntil) && (
                <div className="flex items-center justify-center gap-2 text-amber-400 text-sm font-semibold">
                  <CalendarBlank size={16} />
                  {validFrom && validUntil
                    ? `${validFrom.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${validUntil.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                    : validUntil
                    ? `Offer ends ${validUntil.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                    : null}
                </div>
              )}
              {expired && (
                <div className="mt-3">
                  <Badge variant="destructive">This offer has expired</Badge>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Packages */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-center mb-8">Choose Your Package</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {(promo.packages ?? []).map((pkg: PromotionPackage, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`rounded-2xl bg-gradient-to-br ${tierGradient(pkg.tier)} p-px`}
              >
                <div className="bg-card rounded-2xl p-5 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Package {i + 1}</p>
                      <h3 className="text-xl font-bold">{pkg.tier}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-amber-500">${pkg.price}</p>
                      <p className="text-xs text-muted-foreground">{pkg.currency}</p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 flex-1 mb-4">
                    {pkg.features.map((f: string, fi: number) => (
                      <li key={fi} className="flex items-start gap-2 text-sm">
                        <CheckCircle size={16} weight="fill" className="text-amber-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!expired && (
                    <Link href={`/booking?promotion=${promo.id}&package=${encodeURIComponent(pkg.tier)}&price=${pkg.price}&currency=${pkg.currency}&title=${encodeURIComponent(promo.title)}`}>
                      <Button
                        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold"
                        disabled={!!expired}
                      >
                        <CalendarBlank size={16} className="mr-2" />
                        Book {pkg.tier} – ${pkg.price}
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Add-ons */}
          {(promo.addons ?? []).length > 0 && (
            <div className="mt-10">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Star size={20} weight="fill" className="text-amber-500" />
                Special Upgrades
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {promo.addons.map((addon: PromotionAddon, i: number) => (
                  <div key={i} className="border rounded-xl p-4 bg-muted/30">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{addon.name}</p>
                        {addon.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>
                        )}
                      </div>
                      <p className="font-bold text-amber-500 text-sm flex-shrink-0">
                        +${addon.price} {addon.currency}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms */}
          {promo.terms && (
            <p className="text-center text-sm text-muted-foreground mt-10 border-t pt-6">
              {promo.terms}
            </p>
          )}

          {/* CTA */}
          {!expired && (
            <div className="text-center mt-8">
              <Link href="/contact">
                <Button variant="outline" size="lg">
                  Have questions? Contact us
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
