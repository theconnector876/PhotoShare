import { useEffect, useRef, ReactNode } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';

type RevealVariant = 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'scale-in' | 'fade-down';

const variants = {
  'fade-up':    { hidden: { opacity: 0, y: 48 },       visible: { opacity: 1, y: 0 } },
  'fade-down':  { hidden: { opacity: 0, y: -32 },      visible: { opacity: 1, y: 0 } },
  'fade-in':    { hidden: { opacity: 0 },               visible: { opacity: 1 } },
  'slide-left': { hidden: { opacity: 0, x: -60 },      visible: { opacity: 1, x: 0 } },
  'slide-right':{ hidden: { opacity: 0, x: 60 },       visible: { opacity: 1, x: 0 } },
  'scale-in':   { hidden: { opacity: 0, scale: 0.88 }, visible: { opacity: 1, scale: 1 } },
};

interface ScrollRevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}

export function ScrollReveal({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 0.65,
  className = '',
  once = true,
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, margin: '-60px' as any });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start('visible');
    } else if (!once) {
      controls.start('hidden');
    }
  }, [isInView, controls, once]);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={controls}
      variants={variants[variant]}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger children reveals */
export function StaggerReveal({
  children,
  staggerDelay = 0.08,
  className = '',
}: {
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' as any });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        visible: { transition: { staggerChildren: staggerDelay } },
        hidden: {},
      }}
    >
      {children}
    </motion.div>
  );
}

export const RevealItem = ({
  children,
  variant = 'fade-up',
  className = '',
}: {
  children: ReactNode;
  variant?: RevealVariant;
  className?: string;
}) => (
  <motion.div
    className={className}
    variants={variants[variant]}
    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);
