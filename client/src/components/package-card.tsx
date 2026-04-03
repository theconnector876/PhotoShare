import { Check, Clock, Images, MapPin } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface PackageFeature {
  text: string;
  icon: string;
}

interface PackageCardProps {
  name: string;
  price: number | string;
  features: PackageFeature[];
  isSelected?: boolean;
  onClick?: () => void;
  color: 'bronze' | 'silver' | 'gold' | 'platinum';
  duration?: number;
  images?: number;
  locations?: number;
  showImagePlus?: boolean;
  imageDescription?: string;
}

// Tier-specific design tokens
const TIER_CONFIG = {
  bronze: {
    text: 'text-amber-700 dark:text-amber-600',
    border: 'hover:border-amber-600/50',
    selectedBorder: 'border-amber-600 shadow-amber-600/20',
    bg: 'from-amber-900/5 to-transparent dark:from-amber-600/8',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-600/15 dark:text-amber-500',
    icon: 'text-amber-600',
    glow: 'rgba(180,83,9,0.12)',
  },
  silver: {
    text: 'text-slate-500 dark:text-slate-400',
    border: 'hover:border-slate-400/50',
    selectedBorder: 'border-slate-400 shadow-slate-400/20',
    bg: 'from-slate-200/20 to-transparent dark:from-slate-400/8',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-400',
    icon: 'text-slate-500 dark:text-slate-400',
    glow: 'rgba(100,116,139,0.1)',
  },
  gold: {
    text: 'text-amber-500 dark:text-amber-400',
    border: 'hover:border-amber-500/60',
    selectedBorder: 'border-amber-500 shadow-amber-500/25',
    bg: 'from-amber-500/8 to-transparent dark:from-amber-500/10',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    icon: 'text-amber-500',
    glow: 'rgba(245,158,11,0.15)',
  },
  platinum: {
    text: 'text-slate-300 dark:text-slate-200',
    border: 'hover:border-slate-300/60',
    selectedBorder: 'border-slate-300 shadow-slate-300/20 dark:border-slate-200/40',
    bg: 'from-slate-300/10 to-transparent dark:from-white/5',
    badge: 'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-200',
    icon: 'text-slate-400 dark:text-slate-300',
    glow: 'rgba(203,213,225,0.1)',
  },
} as const;

export default function PackageCard({
  name,
  price,
  features,
  isSelected = false,
  onClick,
  color,
  duration,
  images,
  locations,
  showImagePlus = false,
  imageDescription = "retouched images"
}: PackageCardProps) {
  const tier = TIER_CONFIG[color];

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Card
        className={`relative overflow-hidden cursor-pointer rounded-2xl border transition-all duration-300 ${
          isSelected
            ? `${tier.selectedBorder} shadow-xl bg-gradient-to-b ${tier.bg}`
            : `border-border/50 ${tier.border} hover:shadow-lg bg-card`
        }`}
        onClick={onClick}
        data-testid={`package-card-${name.toLowerCase()}`}
        style={isSelected ? { boxShadow: `0 8px 32px ${tier.glow}` } : undefined}
      >
        {/* Gradient top accent */}
        <div
          className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl transition-opacity duration-300 ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
          }`}
          style={{
            background: color === 'platinum'
              ? 'linear-gradient(90deg, #94a3b8, #e2e8f0, #94a3b8)'
              : color === 'gold'
                ? 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)'
                : color === 'bronze'
                  ? 'linear-gradient(90deg, #92400e, #b45309, #d97706)'
                  : 'linear-gradient(90deg, #475569, #94a3b8, #475569)',
          }}
        />

        <div className="p-6">
          {/* Tier badge + name */}
          <div className="flex items-center justify-between mb-4">
            <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded-full ${tier.badge}`}>
              {name}
            </span>
            {isSelected && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Check size={10} weight="bold" className={tier.icon} /> Selected
              </span>
            )}
          </div>

          {/* Price */}
          <div className={`text-3xl font-extrabold tracking-tight mb-5 ${tier.text}`}>
            {typeof price === 'number' ? `$${price.toLocaleString()}` : price}
          </div>

          {/* Quick specs */}
          {(duration || images || locations) && (
            <div className="space-y-2 mb-5 pb-5 border-b border-border/50">
              {!!duration && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Clock size={14} weight="duotone" className={tier.icon} />
                  <span>
                    {duration === 0
                      ? 'Full Day Coverage'
                      : duration <= 24
                        ? `${duration} hours`
                        : `${duration} minutes`}
                  </span>
                </div>
              )}
              {!!images && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Images size={14} weight="duotone" className={tier.icon} />
                  <span>{images}{showImagePlus ? '+' : ''} {imageDescription}</span>
                </div>
              )}
              {!!locations && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <MapPin size={14} weight="duotone" className={tier.icon} />
                  <span>{locations} location{locations > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}

          {/* Features list */}
          {features.length > 0 && (
            <ul className="space-y-2.5">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2.5 text-sm text-muted-foreground" data-testid={`feature-${index}-${name.toLowerCase()}`}>
                  <Check size={14} weight="bold" className={`${tier.icon} mt-0.5 shrink-0`} />
                  <span>{feature.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
