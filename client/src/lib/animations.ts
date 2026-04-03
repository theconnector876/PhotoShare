// anime.js v4 animation utilities for the site
import { animate, stagger } from 'animejs';

export function staggerFadeIn(targets: string | Element | Element[], delay = 0) {
  return animate(targets as any, {
    opacity: [0, 1],
    translateY: [30, 0],
    duration: 700,
    delay: stagger(80, { start: delay }),
    ease: 'outCubic',
  });
}

export function countUp(target: Element, to: number, duration = 1800) {
  const obj = { val: 0 };
  return animate(obj, {
    val: to,
    duration,
    ease: 'outExpo',
    onUpdate() {
      target.textContent = Math.round(obj.val).toLocaleString();
    },
  });
}

export function apertureOpen(targets: string | Element[]) {
  return animate(targets as any, {
    rotate: [0, 45],
    opacity: [1, 0],
    scale: [1, 0.3],
    duration: 500,
    ease: 'inOutQuart',
    delay: stagger(40),
  });
}

export function apertureClose(targets: string | Element[]) {
  return animate(targets as any, {
    rotate: [45, 0],
    opacity: [0, 1],
    scale: [0.3, 1],
    duration: 600,
    ease: 'outBack',
    delay: stagger(40),
  });
}

// ── Legacy helpers kept for backward compatibility ─────────────────────────

export interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: string;
  staggerDelay?: number;
}

export const defaultAnimationConfig: AnimationConfig = {
  duration: 600,
  delay: 0,
  easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  staggerDelay: 100,
};

export class ParticleSystem {
  private container: HTMLElement;
  private particles: HTMLElement[] = [];
  private animationFrame: number | null = null;
  private mouseX = 0;
  private mouseY = 0;

  constructor(container: HTMLElement, particleCount = 50) {
    this.container = container;
    this.createParticles(particleCount);
    this.bindEvents();
    this.animate();
  }

  private createParticles(count: number) {
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
      particle.style.opacity = (Math.random() * 0.5 + 0.3).toString();
      particle.style.transform = `scale(${Math.random() * 0.5 + 0.5})`;
      this.container.appendChild(particle);
      this.particles.push(particle);
    }
  }

  private bindEvents() {
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  private animate() {
    this.particles.forEach((particle) => {
      const rect = particle.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(this.mouseX - rect.left, 2) + Math.pow(this.mouseY - rect.top, 2)
      );
      if (distance < 150) {
        const scale = 1 + (150 - distance) / 150;
        const opacity = Math.min(1, 0.7 + (150 - distance) / 300);
        particle.style.transform = `scale(${scale})`;
        particle.style.opacity = opacity.toString();
      } else {
        particle.style.transform = 'scale(1)';
        particle.style.opacity = '0.7';
      }
    });
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  public destroy() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.particles.forEach(p => p.remove());
    this.particles = [];
  }
}

export class ScrollAnimationObserver {
  private observer: IntersectionObserver;
  private elements: Map<Element, AnimationConfig> = new Map();

  constructor(config: AnimationConfig = {}) {
    const finalConfig = { ...defaultAnimationConfig, ...config };
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            const elementConfig = this.elements.get(element) || finalConfig;
            this.animateElement(element, elementConfig);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
  }

  public observe(element: Element, config?: AnimationConfig) {
    this.elements.set(element, { ...defaultAnimationConfig, ...config });
    this.observer.observe(element);
  }

  private animateElement(element: HTMLElement, config: AnimationConfig) {
    element.style.animationDelay = `${config.delay}ms`;
    element.style.animationDuration = `${config.duration}ms`;
    element.style.animationTimingFunction = config.easing || defaultAnimationConfig.easing!;
    element.classList.add('slide-in-up');
  }

  public disconnect() {
    this.observer.disconnect();
    this.elements.clear();
  }
}

export function staggerAnimation(
  elements: NodeListOf<Element> | Element[],
  config: AnimationConfig = {}
) {
  const finalConfig = { ...defaultAnimationConfig, ...config };
  Array.from(elements).forEach((element, index) => {
    const staggerDelay = (finalConfig.delay || 0) + (index * (finalConfig.staggerDelay || 100));
    const htmlElement = element as HTMLElement;
    setTimeout(() => {
      htmlElement.style.animationDelay = '0ms';
      htmlElement.style.animationDuration = `${finalConfig.duration}ms`;
      htmlElement.style.animationTimingFunction = finalConfig.easing!;
      htmlElement.classList.add('slide-in-up');
    }, staggerDelay);
  });
}

export function animateCounter(
  element: HTMLElement,
  start: number,
  end: number,
  duration = 1000,
  formatFn?: (value: number) => string
) {
  const startTime = performance.now();
  const format = formatFn || ((value: number) => value.toString());
  const update = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 4);
    const current = Math.round(start + (end - start) * easeProgress);
    element.textContent = format(current);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

export function initMagneticButtons() {
  const magneticElements = document.querySelectorAll('.magnetic-btn');
  magneticElements.forEach((element) => {
    const htmlElement = element as HTMLElement;
    htmlElement.addEventListener('mouseenter', () => {
      htmlElement.style.transform = 'translateY(-2px) scale(1.05)';
      htmlElement.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.2)';
    });
    htmlElement.addEventListener('mouseleave', () => {
      htmlElement.style.transform = '';
      htmlElement.style.boxShadow = '';
    });
    htmlElement.addEventListener('mousemove', (e) => {
      const rect = htmlElement.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      htmlElement.style.transform = `translateY(-2px) scale(1.05) translate(${x * 0.1}px, ${y * 0.1}px)`;
    });
  });
}

export function typewriterEffect(element: HTMLElement, text: string, speed = 50, callback?: () => void) {
  element.textContent = '';
  element.style.borderRight = '3px solid var(--jamaica-green)';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(timer);
      let visible = true;
      setInterval(() => {
        element.style.borderColor = visible ? 'var(--jamaica-green)' : 'transparent';
        visible = !visible;
      }, 750);
      if (callback) callback();
    }
  }, speed);
}

import React from 'react';

export function useAnimationOnMount(elementRef: React.RefObject<HTMLElement>, config?: AnimationConfig) {
  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const finalConfig = { ...defaultAnimationConfig, ...config };
    setTimeout(() => {
      element.style.animationDelay = `${finalConfig.delay}ms`;
      element.style.animationDuration = `${finalConfig.duration}ms`;
      element.style.animationTimingFunction = finalConfig.easing!;
      element.classList.add('slide-in-up');
    }, 100);
  }, [elementRef, config]);
}

export function initializeAnimations() {
  initMagneticButtons();
  const scrollObserver = new ScrollAnimationObserver();
  document.querySelectorAll('.hover-lift, .slide-in-up').forEach((element) => {
    scrollObserver.observe(element);
  });
  return { scrollObserver, destroy: () => scrollObserver.disconnect() };
}
