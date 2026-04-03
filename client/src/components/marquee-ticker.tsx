interface MarqueeTickerProps {
  items?: string[];
  speed?: number;
  className?: string;
}

const DEFAULT_ITEMS = [
  'Wedding Photography',
  'Portrait Sessions',
  'Event Coverage',
  'Videography',
  'Commercial Work',
  'Family Portraits',
  'Engagement Shoots',
  'Fashion & Editorial',
];

export function MarqueeTicker({ items = DEFAULT_ITEMS, className = '' }: MarqueeTickerProps) {
  const doubled = [...items, ...items, ...items];

  return (
    <div className={`overflow-hidden bg-amber-500 py-3 select-none ${className}`}>
      <div className="flex whitespace-nowrap animate-marquee">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span className="text-black font-bold text-[11px] tracking-[0.18em] uppercase px-5">
              {item}
            </span>
            <span className="text-black/40 text-[10px]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function MarqueeTickerDark({ items = DEFAULT_ITEMS, className = '' }: MarqueeTickerProps) {
  const doubled = [...items, ...items, ...items];

  return (
    <div className={`overflow-hidden bg-[hsl(222,20%,5%)] dark:bg-[hsl(222,20%,5%)] border-y border-white/[0.06] py-3 select-none ${className}`}>
      <div className="flex whitespace-nowrap animate-marquee-slow">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span className="text-white/40 font-semibold text-[11px] tracking-[0.2em] uppercase px-5">
              {item}
            </span>
            <span className="text-amber-500/50 text-[10px]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
