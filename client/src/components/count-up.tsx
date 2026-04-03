import { useEffect, useRef } from 'react';
import { useInView } from 'framer-motion';
import { animate } from 'animejs';

interface CountUpProps {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}

export function CountUp({ to, suffix = '', prefix = '', duration = 2000, className = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' as any });
  const animated = useRef(false);

  useEffect(() => {
    if (!isInView || animated.current || !ref.current) return;
    animated.current = true;
    const el = ref.current;
    const obj = { val: 0 };
    animate(obj, {
      val: to,
      duration,
      ease: 'outExpo',
      onUpdate() {
        el.textContent = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`;
      },
    } as any);
  }, [isInView, to, suffix, prefix, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
