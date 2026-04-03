import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

export function ApertureLoader({ size = 80, className = '' }: { size?: number; className?: string }) {
  const containerRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const blades = containerRef.current.querySelectorAll('.blade');

    const anim = animate(blades, {
      rotate: (_el: Element, i: number) => [i * 60, i * 60 + 60],
      duration: 1200,
      loop: true,
      alternate: true,
      ease: 'inOutSine',
      delay: stagger(50),
    } as any);

    const ring = containerRef.current.querySelector('.ring');
    if (ring) {
      animate(ring, {
        rotate: [0, 360],
        duration: 3000,
        loop: true,
        ease: 'linear',
      } as any);
    }

    return () => {
      if (anim && typeof (anim as any).pause === 'function') (anim as any).pause();
    };
  }, []);

  return (
    <svg
      ref={containerRef}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
    >
      {/* Outer ring */}
      <circle
        className="ring"
        cx="50" cy="50" r="44"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="1"
        strokeDasharray="8 4"
        opacity="0.4"
        style={{ transformOrigin: '50px 50px' }}
      />
      {/* Center dot */}
      <circle cx="50" cy="50" r="4" fill="#f59e0b" opacity="0.8" />

      {/* 6 aperture blades */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => (
        <g key={i} style={{ transformOrigin: '50px 50px', transform: `rotate(${angle}deg)` }}>
          <ellipse
            className="blade"
            cx="50" cy="26"
            rx="8" ry="22"
            fill="#f59e0b"
            opacity="0.85"
            style={{ transformOrigin: '50px 50px' }}
          />
        </g>
      ))}
    </svg>
  );
}

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <ApertureLoader size={72} />
      <p className="mt-6 text-[11px] tracking-[0.3em] uppercase text-muted-foreground font-medium">
        Loading
      </p>
    </div>
  );
}
