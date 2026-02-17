import { useEffect, useRef } from "react";

export default function ConstellationBackground() {
  const constellationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const constellation = constellationRef.current;
    if (!constellation) return;

    // Create floating particles
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 6 + 's';
      particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
      constellation.appendChild(particle);
    }

    // Create floating shapes
    const shapesContainer = document.createElement('div');
    shapesContainer.className = 'floating-shapes';
    
    const shapes = [
      { size: 'w-8 h-8', color: 'bg-jamaica-green/20', shape: 'rounded-full', delay: '0s' },
      { size: 'w-12 h-12', color: 'bg-jamaica-yellow/20', shape: 'rounded-lg', delay: '-5s' },
      { size: 'w-6 h-6', color: 'bg-jamaica-gold/20', shape: 'rounded-full', delay: '-10s' },
      { size: 'w-10 h-10', color: 'bg-jamaica-green/20', shape: 'rounded-lg rotate-45', delay: '-15s' },
    ];

    shapes.forEach((shapeConfig, index) => {
      const shape = document.createElement('div');
      shape.className = `shape ${shapeConfig.size} ${shapeConfig.color} ${shapeConfig.shape}`;
      shape.style.left = (20 + index * 20) + '%';
      shape.style.animationDelay = shapeConfig.delay;
      shapesContainer.appendChild(shape);
    });

    constellation.appendChild(shapesContainer);

    // Mouse interaction effect
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const particles = constellation.querySelectorAll('.particle');
      
      particles.forEach((particle, index) => {
        const rect = particle.getBoundingClientRect();
        const distance = Math.sqrt(
          Math.pow(clientX - rect.left, 2) + Math.pow(clientY - rect.top, 2)
        );
        
        if (distance < 100) {
          const scale = 1 + (100 - distance) / 100;
          (particle as HTMLElement).style.transform = `scale(${scale})`;
          (particle as HTMLElement).style.opacity = '1';
        } else {
          (particle as HTMLElement).style.transform = 'scale(1)';
          (particle as HTMLElement).style.opacity = '0.7';
        }
      });
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return <div ref={constellationRef} className="constellation-bg" />;
}
