import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Camera, Instagram, Facebook, Globe, ChevronLeft, ChevronRight, Star, Calendar } from "lucide-react";
import type { PricingConfig } from "@shared/pricing";
import { useCurrency } from "@/context/currency";

interface PhotographerPublic {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
  bio: string | null;
  location: string | null;
  specialties: string[];
  portfolioLinks: string[];
  availability: string | null;
  socials: Record<string, string>;
}

interface Catalogue {
  id: string;
  title: string;
  description: string;
  serviceType: string;
  coverImage: string;
  images: string[];
  photographerName?: string | null;
}

const TIER_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-100 border-amber-300 text-amber-900",
  silver: "bg-slate-100 border-slate-300 text-slate-800",
  gold: "bg-yellow-100 border-yellow-300 text-yellow-900",
  platinum: "bg-purple-100 border-purple-300 text-purple-900",
};

function CatalogueCard({ cat }: { cat: Catalogue }) {
  const [idx, setIdx] = useState(0);
  const imgs = cat.images?.length ? cat.images : [cat.coverImage].filter(Boolean);
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      <Card className="overflow-hidden group cursor-pointer" onClick={() => setLightbox(true)}>
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {imgs[idx] ? (
            <img src={imgs[idx]} alt={cat.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Camera className="w-8 h-8" />
            </div>
          )}
          {imgs.length > 1 && (
            <>
              <button
                className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + imgs.length) % imgs.length); }}
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % imgs.length); }}
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                {imgs.slice(0, 5).map((_, i) => (
                  <span key={i} className={`w-1 h-1 rounded-full ${i === idx ? "bg-white" : "bg-white/50"}`} />
                ))}
              </div>
            </>
          )}
          <Badge className="absolute top-2 left-2 text-[10px] capitalize bg-black/60 text-white border-0">
            {cat.serviceType}
          </Badge>
        </div>
        <CardContent className="p-3">
          <p className="font-semibold text-sm truncate">{cat.title}</p>
          {cat.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{cat.description}</p>}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(false)}>
            ✕
          </button>
          {imgs.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 text-white rounded-full p-2"
              onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + imgs.length) % imgs.length); }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <img
            src={imgs[idx]}
            alt=""
            className="max-h-[85vh] max-w-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          {imgs.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 text-white rounded-full p-2"
              onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % imgs.length); }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">{idx + 1} / {imgs.length}</p>
        </div>
      )}
    </>
  );
}

function PackageCard({ tier, price, details }: { tier: string; price: number; details?: { duration?: number; images?: number; locations?: number } }) {
  const { format } = useCurrency();
  return (
    <div className={`rounded-xl border-2 p-4 ${TIER_COLORS[tier] || "bg-muted border-muted"}`}>
      <div className="flex justify-between items-start">
        <span className="font-bold text-sm capitalize">{TIER_LABELS[tier] || tier}</span>
        <span className="font-bold text-base">{format(price)}</span>
      </div>
      {details && (
        <ul className="mt-2 space-y-0.5 text-xs opacity-80">
          {details.duration && <li>⏱ {details.duration} min</li>}
          {details.images && <li>📷 {details.images} images</li>}
          {details.locations && <li>📍 {details.locations} location{details.locations > 1 ? "s" : ""}</li>}
        </ul>
      )}
    </div>
  );
}

export default function PhotographerProfile() {
  const [match, params] = useRoute("/photographer/:photographerId");
  const [, navigate] = useLocation();
  const photographerId = match ? params?.photographerId : undefined;
  const [activeService, setActiveService] = useState<"photoshoot" | "wedding" | "event">("photoshoot");

  const { data: photographer, isLoading: loadingProfile } = useQuery<PhotographerPublic>({
    queryKey: [`/api/photographers/${photographerId}/public`],
    enabled: !!photographerId,
  });

  const { data: pricing, isLoading: loadingPricing } = useQuery<PricingConfig>({
    queryKey: [`/api/pricing?photographerId=${photographerId}`],
    queryFn: async () => {
      const res = await fetch(`/api/pricing?photographerId=${photographerId}`);
      return res.json();
    },
    enabled: !!photographerId,
  });

  const { data: catalogues, isLoading: loadingCats } = useQuery<Catalogue[]>({
    queryKey: [`/api/catalogues?photographerId=${photographerId}`],
    queryFn: async () => {
      const res = await fetch(`/api/catalogues?photographerId=${photographerId}`);
      return res.json();
    },
    enabled: !!photographerId,
  });

  if (!photographerId) return null;

  const initials = photographer?.displayName
    ?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "P";

  const socials = photographer?.socials || {};

  return (
    <div className="pt-20 pb-16 relative z-10">
      <div className="max-w-4xl mx-auto px-4 space-y-10">

        {/* Back */}
        <button
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => window.history.back()}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {/* Hero Header */}
        {loadingProfile ? (
          <div className="flex gap-5 items-center">
            <Skeleton className="w-24 h-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ) : photographer ? (
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-lg shrink-0">
              <AvatarImage src={photographer.profileImageUrl ?? undefined} />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold">{photographer.displayName}</h1>
              {photographer.location && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-4 h-4 shrink-0" /> {photographer.location}
                </p>
              )}
              {photographer.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {photographer.specialties.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}
              {/* Socials */}
              <div className="flex gap-3 mt-3">
                {socials.instagram && (
                  <a href={`https://instagram.com/${socials.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {socials.facebook && (
                  <a href={socials.facebook} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {socials.website && (
                  <a href={socials.website} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                    <Globe className="w-4 h-4" />
                  </a>
                )}
              </div>
              {photographer.bio && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-prose">{photographer.bio}</p>
              )}
              {photographer.availability && (
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {photographer.availability}
                </p>
              )}
            </div>
            <Button
              size="lg"
              className="shrink-0 self-start"
              onClick={() => navigate(`/book/${photographerId}`)}
            >
              Book Now
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">Photographer not found.</p>
        )}

        {/* Portfolio / Past Work */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" /> Past Work
          </h2>
          {loadingCats ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
            </div>
          ) : catalogues?.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {catalogues.map(cat => <CatalogueCard key={cat.id} cat={cat} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No portfolio items published yet.
              </CardContent>
            </Card>
          )}
        </section>

        {/* Packages & Pricing */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" /> Packages & Pricing
          </h2>

          {/* Service tabs */}
          <div className="flex gap-2 mb-5">
            {(["photoshoot", "wedding", "event"] as const).map(s => (
              <button
                key={s}
                onClick={() => setActiveService(s)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  activeService === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {loadingPricing ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : pricing ? (
            <>
              {activeService === "photoshoot" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Photography</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["bronze", "silver", "gold", "platinum"] as const).map(tier => {
                        const pkg = pricing.packages.photoshoot.photography[tier];
                        return (
                          <PackageCard key={tier} tier={tier} price={pkg.price} details={{ duration: pkg.duration, images: pkg.images, locations: pkg.locations }} />
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Videography</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["bronze", "silver", "gold", "platinum"] as const).map(tier => (
                        <PackageCard key={tier} tier={tier} price={pricing.packages.photoshoot.videography[tier]} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeService === "wedding" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Photography</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["bronze", "silver", "gold", "platinum"] as const).map(tier => (
                        <PackageCard key={tier} tier={tier} price={pricing.packages.wedding.photography[tier]} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Videography</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(["bronze", "silver", "gold", "platinum"] as const).map(tier => (
                        <PackageCard key={tier} tier={tier} price={pricing.packages.wedding.videography[tier]} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeService === "event" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border-2 border-border bg-muted/30 p-5">
                    <p className="font-semibold mb-1">Photography</p>
                    <p className="text-sm text-muted-foreground">
                      ${pricing.packages.event.photography.baseRate}/hr &middot; min {pricing.packages.event.photography.minimumHours} hrs
                    </p>
                  </div>
                  <div className="rounded-xl border-2 border-border bg-muted/30 p-5">
                    <p className="font-semibold mb-1">Videography</p>
                    <p className="text-sm text-muted-foreground">
                      ${pricing.packages.event.videography.baseRate}/hr &middot; min {pricing.packages.event.videography.minimumHours} hrs
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : null}

          <div className="mt-6 text-center">
            <Button size="lg" onClick={() => navigate(`/book/${photographerId}`)}>
              Book This Photographer
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Choose your full package during booking</p>
          </div>
        </section>

      </div>
    </div>
  );
}
