// Animation utility functions and configurations for The Connector Photography

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

// Particle animation system for constellation background
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
      
      // Add random opacity and size variations
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
    this.particles.forEach((particle, index) => {
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
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.particles.forEach(particle => particle.remove());
    this.particles = [];
  }
}

// Scroll-triggered animation observer
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
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
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

// Stagger animation for multiple elements
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

// Counter animation for numbers
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
    
    // Use easeOutQuart for smooth deceleration
    const easeProgress = 1 - Math.pow(1 - progress, 4);
    const current = Math.round(start + (end - start) * easeProgress);
    
    element.textContent = format(current);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  };
  
  requestAnimationFrame(update);
}

// Magnetic button effect
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
      
      const moveX = x * 0.1;
      const moveY = y * 0.1;
      
      htmlElement.style.transform = `translateY(-2px) scale(1.05) translate(${moveX}px, ${moveY}px)`;
    });
  });
}

// Typewriter effect
export function typewriterEffect(
  element: HTMLElement,
  text: string,
  speed = 50,
  callback?: () => void
) {
  element.textContent = '';
  element.style.borderRight = '3px solid var(--jamaica-green)';
  
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
    } else {
      clearInterval(timer);
      
      // Add blinking cursor effect
      let visible = true;
      setInterval(() => {
        element.style.borderColor = visible ? 'var(--jamaica-green)' : 'transparent';
        visible = !visible;
      }, 750);
      
      if (callback) callback();
    }
  }, speed);
}

// 3D hover effect for cards
export function init3DHoverEffects() {
  const hoverElements = document.querySelectorAll('.hover-3d');
  
  hoverElements.forEach((element) => {
    const htmlElement = element as HTMLElement;
    
    htmlElement.addEventListener('mouseenter', () => {
      htmlElement.style.transform = 'translateY(-5px) rotateX(5deg)';
      htmlElement.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
    });
    
    htmlElement.addEventListener('mouseleave', () => {
      htmlElement.style.transform = '';
      htmlElement.style.boxShadow = '';
    });
    
    htmlElement.addEventListener('mousemove', (e) => {
      const rect = htmlElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = -(x - centerX) / 20;
      
      htmlElement.style.transform = `translateY(-5px) rotateX(${5 + rotateX}deg) rotateY(${rotateY}deg)`;
    });
  });
}

// Glow pulse animation
export function initGlowEffects() {
  const glowElements = document.querySelectorAll('.animate-glow');
  
  glowElements.forEach((element) => {
    const htmlElement = element as HTMLElement;
    
    // Add random animation delay for more organic feel
    const delay = Math.random() * 2;
    htmlElement.style.animationDelay = `${delay}s`;
  });
}

// Initialize all animation systems
export function initializeAnimations() {
  // Initialize magnetic button effects
  initMagneticButtons();
  
  // Initialize 3D hover effects
  init3DHoverEffects();
  
  // Initialize glow effects
  initGlowEffects();
  
  // Initialize scroll animations
  const scrollObserver = new ScrollAnimationObserver();
  
  // Observe elements with animation classes
  document.querySelectorAll('.hover-3d, .slide-in-up').forEach((element) => {
    scrollObserver.observe(element);
  });
  
  // Stagger animations for grid items
  const portfolioItems = document.querySelectorAll('[data-testid^="portfolio-image"]');
  if (portfolioItems.length > 0) {
    staggerAnimation(portfolioItems, { staggerDelay: 50 });
  }
  
  const serviceCards = document.querySelectorAll('[data-testid^="service-"]');
  if (serviceCards.length > 0) {
    staggerAnimation(serviceCards, { staggerDelay: 100 });
  }
  
  return {
    scrollObserver,
    destroy: () => {
      scrollObserver.disconnect();
    }
  };
}

// Custom hook-like function for React components
import React from 'react';

export function useAnimationOnMount(
  elementRef: React.RefObject<HTMLElement>,
  config?: AnimationConfig
) {
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

