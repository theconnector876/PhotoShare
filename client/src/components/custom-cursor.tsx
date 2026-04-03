import { useState, useEffect, useRef } from 'react';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    // Only run on devices that have a mouse
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let raf: number;
    let dotX = 0, dotY = 0;
    let ringX = 0, ringY = 0;

    const onMove = (e: MouseEvent) => {
      dotX = e.clientX;
      dotY = e.clientY;
      if (!isVisible) setIsVisible(true);
    };

    const loop = () => {
      ringX += (dotX - ringX) * 0.1;
      ringY += (dotY - ringY) * 0.1;

      if (dotRef.current) {
        dotRef.current.style.left = `${dotX}px`;
        dotRef.current.style.top = `${dotY}px`;
      }
      if (ringRef.current) {
        ringRef.current.style.left = `${ringX}px`;
        ringRef.current.style.top = `${ringY}px`;
      }
      raf = requestAnimationFrame(loop);
    };

    const onHoverIn = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.dataset.cursor) {
        setIsHovering(true);
      }
    };
    const onHoverOut = () => setIsHovering(false);

    const onMouseDown = () => setIsClicking(true);
    const onMouseUp = () => setIsClicking(false);
    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    document.documentElement.addEventListener('mouseenter', onMouseEnter);

    // Attach hover detection to interactive elements
    const addHoverListeners = () => {
      document.querySelectorAll('a, button, [data-cursor], input, textarea, select, [role="button"]').forEach(el => {
        el.addEventListener('mouseenter', onHoverIn);
        el.addEventListener('mouseleave', onHoverOut);
      });
    };
    addHoverListeners();

    const observer = new MutationObserver(addHoverListeners);
    observer.observe(document.body, { childList: true, subtree: true });

    raf = requestAnimationFrame(loop);

    // Hide native cursor
    document.documentElement.style.cursor = 'none';

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      document.documentElement.removeEventListener('mouseenter', onMouseEnter);
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.documentElement.style.cursor = '';
    };
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {/* Dot — snaps to cursor */}
      <div
        ref={dotRef}
        className={`fixed z-[99999] pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-100 ${
          isClicking ? 'scale-75' : 'scale-100'
        } ${isHovering ? 'w-2 h-2 bg-amber-400' : 'w-2 h-2 bg-amber-500'}`}
        style={{ willChange: 'left, top' }}
      />
      {/* Ring — lags behind */}
      <div
        ref={ringRef}
        className={`fixed z-[99998] pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-200 ${
          isHovering
            ? 'w-10 h-10 border-amber-400/70 bg-amber-500/8 scale-110'
            : isClicking
            ? 'w-6 h-6 border-amber-500/80'
            : 'w-7 h-7 border-amber-500/50'
        }`}
        style={{ willChange: 'left, top' }}
      />
    </>
  );
}
