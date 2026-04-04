import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarBlank, CheckCircle, Star, Ticket, User, Envelope, Phone, MapPin, Clock } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { Promotion, PromotionPackage, PromotionAddon } from "@/components/admin-promotions";

const BADGE_COLORS: Record<string, string> = {
  deal: "bg-blue-500", new: "bg-emerald-500", sale: "bg-red-500",
  special: "bg-amber-500", seasonal: "bg-purple-500", hot: "bg-orange-500",
};

const TIER_GRADIENTS: Record<string, string> = {
  bronze:   "from-amber-700/30 to-amber-900/10",
  silver:   "from-slate-400/30 to-slate-600/10",
  gold:     "from-amber-400/30 to-amber-600/10",
  platinum: "from-slate-300/30 to-slate-500/10",
};

const TIER_ACCENT: Record<string, string> = {
  bronze: "border-amber-700", silver: "border-slate-400",
  gold: "border-amber-400",  platinum: "border-slate-300",
};

const PARISHES = [
  "Kingston","St. Andrew","St. Thomas","Portland","St. Mary",
  "St. Ann","Trelawny","St. James","Hanover","Westmoreland",
  "St. Elizabeth","Manchester","Clarendon","St. Catherine",
];

const TIMES = [
  "6:00 AM","6:30 AM","7:00 AM","7:30 AM","8:00 AM","8:30 AM",
  "9:00 AM","9:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM",
  "12:00 PM","12:30 PM","1:00 PM","1:30 PM","2:00 PM","2:30 PM",
  "3:00 PM","3:30 PM","4:00 PM","4:30 PM","5:00 PM","5:30 PM","6:00 PM",
];

function tierGradient(tier: string) {
  return TIER_GRADIENTS[tier.toLowerCase()] ?? "from-zinc-600/20 to-zinc-800/10";
}
function tierAccent(tier: string) {
  return TIER_ACCENT[tier.toLowerCase()] ?? "border-amber-500";
}

interface BookingForm {
  clientName: string;
  email: string;
  contactNumber: string;
  shootDate: Date | undefined;
  shootTime: string;
  location: string;
  parish: string;
  clientInitials: string;
  selectedAddons: string[];
  contractAccepted: boolean;
}

function emptyForm(): BookingForm {
  return {
    clientName: "", email: "", contactNumber: "",
    shootDate: undefined, shootTime: "", location: "", parish: "",
    clientInitials: "", selectedAddons: [], contractAccepted: false,
  };
}

export default function PromotionPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [selectedPkg, setSelectedPkg] = useState<PromotionPackage | null>(null);
  const [form, setForm] = useState<BookingForm>(emptyForm());
  const [submitted, setSubmitted] = useState(false);

  const { data: promo, isLoading, error } = useQuery<Promotion>({
    queryKey: ["/api/promotions", id],
    queryFn: async () => {
      const res = await fetch(`/api/promotions/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  const bookMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Booking failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err: any) => {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    },
  });

  function handleBook(pkg: PromotionPackage) {
    setSelectedPkg(pkg);
    setForm(emptyForm());
    setTimeout(() => {
      document.getElementById("promo-booking-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function toggleAddon(name: string) {
    setForm(f => ({
      ...f,
      selectedAddons: f.selectedAddons.includes(name)
        ? f.selectedAddons.filter(a => a !== name)
        : [...f.selectedAddons, name],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPkg || !promo) return;

    const addonTotal = (promo.addons ?? [])
      .filter((a: PromotionAddon) => form.selectedAddons.includes(a.name))
      .reduce((sum: number, a: PromotionAddon) => sum + a.price, 0);

    const total = selectedPkg.price + addonTotal;
    const deposit = Math.ceil(total * 0.5);

    bookMutation.mutate({
      clientName: form.clientName,
      email: form.email,
      contactNumber: form.contactNumber,
      serviceType: "photoshoot",
      packageType: `promo-${promo.id}-${selectedPkg.tier.toLowerCase()}`,
      numberOfPeople: 1,
      shootDate: form.shootDate ? form.shootDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "",
      shootTime: form.shootTime,
      location: form.location,
      parish: form.parish,
      transportationFee: 0,
      addons: form.selectedAddons,
      totalPrice: total,
      depositAmount: deposit,
      balanceDue: total - deposit,
      clientInitials: form.clientInitials,
      contractAccepted: form.contractAccepted,
      currency: selectedPkg.currency,
      couponCode: `PROMO-${promo.id}`,
      referralSource: ["promotion"],
    });
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>;
  }

  if (error || !promo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Ticket size={48} className="text-muted-foreground opacity-40" />
        <p className="text-muted-foreground">Promotion not found or no longer available.</p>
        <Link href="/"><Button variant="outline"><ArrowLeft size={16} className="mr-2" /> Go Home</Button></Link>
      </div>
    );
  }

  const badgeColor = BADGE_COLORS[promo.badge] ?? "bg-amber-500";
  const validFrom  = promo.validFrom  ? new Date(promo.validFrom)  : null;
  const validUntil = promo.validUntil ? new Date(promo.validUntil) : null;

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <CheckCircle size={72} weight="fill" className="text-amber-500 mx-auto" />
        </motion.div>
        <h1 className="text-3xl font-extrabold">Booking Request Sent!</h1>
        <p className="text-muted-foreground max-w-md">
          We've received your request for the <strong>{promo.title}</strong> – <strong>{selectedPkg?.tier}</strong> package.
          We'll be in touch shortly to confirm your shoot date.
        </p>
        <Link href="/"><Button className="bg-amber-500 hover:bg-amber-400 text-black font-bold">Back to Home</Button></Link>
      </div>
    );
  }

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
            <img src={promo.imageUrl} alt={promo.title}
              className="absolute inset-0 w-full h-full object-cover opacity-40" />
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
              {promo.subtitle && <p className="text-white/70 text-lg mb-1">{promo.subtitle}</p>}
              <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-4">{promo.title}</h1>
              {(validFrom || validUntil) && (
                <div className="flex items-center justify-center gap-2 text-amber-400 text-sm font-semibold">
                  <CalendarBlank size={16} />
                  <span>
                    Shoot dates available:{" "}
                    {validFrom && validUntil
                      ? `${validFrom.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${validUntil.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                      : validUntil
                      ? `Until ${validUntil.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                      : `From ${validFrom!.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-12 space-y-12">
          {/* Packages */}
          <div>
            <h2 className="text-2xl font-bold text-center mb-2">Choose Your Package</h2>
            <p className="text-center text-sm text-muted-foreground mb-8">Select a package below to begin your booking</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {(promo.packages ?? []).map((pkg: PromotionPackage, i: number) => {
                const isSelected = selectedPkg?.tier === pkg.tier;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className={`rounded-2xl bg-gradient-to-br ${tierGradient(pkg.tier)} border-2 transition-all ${isSelected ? `${tierAccent(pkg.tier)} shadow-lg` : "border-border"}`}>
                    <div className="p-5 h-full flex flex-col">
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
                      <Button
                        onClick={() => handleBook(pkg)}
                        className={`w-full font-bold ${isSelected ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-muted hover:bg-amber-500 hover:text-black"}`}
                      >
                        <CalendarBlank size={16} className="mr-2" />
                        {isSelected ? "Selected — Fill form below" : `Book ${pkg.tier} – $${pkg.price}`}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Add-ons */}
          {(promo.addons ?? []).length > 0 && (
            <div>
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
                        {addon.description && <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>}
                      </div>
                      <p className="font-bold text-amber-500 text-sm flex-shrink-0">+${addon.price} {addon.currency}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Booking form — appears after package selection */}
          <AnimatePresence>
            {selectedPkg && (
              <motion.div
                id="promo-booking-form"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.35 }}
                className="border rounded-2xl p-6 bg-card"
              >
                <h3 className="text-xl font-bold mb-1">
                  Book: {promo.title} — {selectedPkg.tier}
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  ${selectedPkg.price} {selectedPkg.currency} · 50% deposit required
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Personal info */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5"><User size={14} /> Full Name</Label>
                      <Input required value={form.clientName}
                        onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                        placeholder="Your full name" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5"><User size={14} /> Initials</Label>
                      <Input required maxLength={4} value={form.clientInitials}
                        onChange={e => setForm(f => ({ ...f, clientInitials: e.target.value.toUpperCase() }))}
                        placeholder="e.g. A.B." className="uppercase" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5"><Envelope size={14} /> Email</Label>
                      <Input required type="email" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5"><Phone size={14} /> Phone</Label>
                      <Input required value={form.contactNumber}
                        onChange={e => setForm(f => ({ ...f, contactNumber: e.target.value }))}
                        placeholder="+1 876 000 0000" />
                    </div>
                  </div>

                  {/* Date & time — restricted to shoot window */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5"><CalendarBlank size={14} /> Shoot Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarBlank size={15} className="mr-2 text-muted-foreground" />
                            {form.shootDate
                              ? form.shootDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                              : <span className="text-muted-foreground">Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={form.shootDate}
                            onSelect={d => setForm(f => ({ ...f, shootDate: d }))}
                            disabled={(date) => {
                              if (validFrom && date < validFrom) return true;
                              if (validUntil) {
                                const end = new Date(validUntil);
                                end.setHours(23, 59, 59, 999);
                                if (date > end) return true;
                              }
                              return false;
                            }}
                            defaultMonth={validFrom ?? undefined}
                            initialFocus
                          />
                          {(validFrom || validUntil) && (
                            <p className="text-xs text-muted-foreground text-center pb-3">
                              Available:{" "}
                              {validFrom?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              {validUntil ? ` – ${validUntil.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                            </p>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5"><Clock size={14} /> Shoot Time</Label>
                      <Select value={form.shootTime} onValueChange={v => setForm(f => ({ ...f, shootTime: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
                        <SelectContent>
                          {TIMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5"><MapPin size={14} /> Location / Venue</Label>
                      <Input required value={form.location}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                        placeholder="Address or landmark" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Parish</Label>
                      <Select value={form.parish} onValueChange={v => setForm(f => ({ ...f, parish: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select parish" /></SelectTrigger>
                        <SelectContent>
                          {PARISHES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Add-ons selection */}
                  {(promo.addons ?? []).length > 0 && (
                    <div>
                      <Label className="block mb-2">Add-ons (optional)</Label>
                      <div className="space-y-2">
                        {promo.addons.map((addon: PromotionAddon, i: number) => (
                          <label key={i} className="flex items-center gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                            <Checkbox
                              checked={form.selectedAddons.includes(addon.name)}
                              onCheckedChange={() => toggleAddon(addon.name)}
                            />
                            <span className="flex-1 text-sm">{addon.name}</span>
                            <span className="text-sm font-semibold text-amber-500">+${addon.price}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price summary */}
                  <div className="rounded-xl bg-muted/40 p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span>{selectedPkg.tier} Package</span>
                      <span>${selectedPkg.price}</span>
                    </div>
                    {form.selectedAddons.map(name => {
                      const addon = promo.addons?.find((a: PromotionAddon) => a.name === name);
                      return addon ? (
                        <div key={name} className="flex justify-between text-muted-foreground">
                          <span>{name}</span><span>+${addon.price}</span>
                        </div>
                      ) : null;
                    })}
                    <div className="border-t pt-1.5 flex justify-between font-bold">
                      <span>Total</span>
                      <span className="text-amber-500">
                        ${selectedPkg.price + (promo.addons ?? [])
                          .filter((a: PromotionAddon) => form.selectedAddons.includes(a.name))
                          .reduce((s: number, a: PromotionAddon) => s + a.price, 0)} {selectedPkg.currency}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground text-xs">
                      <span>50% Deposit due now</span>
                      <span>${Math.ceil((selectedPkg.price + (promo.addons ?? [])
                        .filter((a: PromotionAddon) => form.selectedAddons.includes(a.name))
                        .reduce((s: number, a: PromotionAddon) => s + a.price, 0)) * 0.5)}</span>
                    </div>
                  </div>

                  {/* Contract */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={form.contractAccepted}
                      onCheckedChange={v => setForm(f => ({ ...f, contractAccepted: !!v }))}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-muted-foreground">
                      I agree to the{" "}
                      <Link href="/terms" className="text-amber-500 underline">terms & conditions</Link>
                    </span>
                  </label>

                  <Button
                    type="submit"
                    disabled={bookMutation.isPending || !form.shootDate || !form.shootTime || !form.parish || !form.contractAccepted}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-base py-5"
                  >
                    {bookMutation.isPending ? "Submitting..." : `Request Booking — $${Math.ceil((selectedPkg.price + (promo.addons ?? []).filter((a: PromotionAddon) => form.selectedAddons.includes(a.name)).reduce((s: number, a: PromotionAddon) => s + a.price, 0)) * 0.5)} Deposit`}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Terms */}
          {promo.terms && (
            <p className="text-center text-sm text-muted-foreground border-t pt-6">{promo.terms}</p>
          )}
        </div>
      </div>
    </>
  );
}
