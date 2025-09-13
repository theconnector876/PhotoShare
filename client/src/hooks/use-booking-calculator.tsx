import { useState, useCallback, useEffect } from "react";

export interface BookingCalculation {
  serviceType: 'photoshoot' | 'wedding' | 'event';
  packageType: string;
  basePrice: number;
  peopleCount: number;
  transportationFee: number;
  addons: string[];
  totalPrice: number;
}

function getServiceTypeFromURL(): 'photoshoot' | 'wedding' | 'event' {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service');
    if (serviceParam && ['photoshoot', 'wedding', 'event'].includes(serviceParam)) {
      return serviceParam as 'photoshoot' | 'wedding' | 'event';
    }
  }
  return 'photoshoot';
}

function getInitialState(serviceType: 'photoshoot' | 'wedding' | 'event'): BookingCalculation {
  const basePrice = serviceType === 'photoshoot' ? 150 : serviceType === 'wedding' ? 500 : 300;
  const transportationFee = 35;
  
  return {
    serviceType,
    packageType: 'bronze',
    basePrice,
    peopleCount: 1,
    transportationFee,
    addons: [],
    totalPrice: basePrice + transportationFee,
  };
}

export function useBookingCalculator() {
  const [calculation, setCalculation] = useState<BookingCalculation>(() => 
    getInitialState(getServiceTypeFromURL())
  );

  const packages = {
    photoshoot: {
      bronze: { price: 150, duration: 45, images: 6, locations: 1 },
      silver: { price: 200, duration: 60, images: 10, locations: 1 },
      gold: { price: 300, duration: 120, images: 15, locations: 1 },
      platinum: { price: 500, duration: 150, images: 25, locations: 2 },
    },
    wedding: {
      photography: {
        bronze: 500, silver: 800, gold: 1250, platinum: 2500
      },
      videography: {
        bronze: 600, silver: 800, gold: 1250, platinum: 1800
      }
    },
    event: {
      baseRate: 150, // per hour
      minimumHours: 2,
      videoRate: 100, // per hour for video add-on
    }
  };

  const addonPrices = {
    highlightReel: 250,
    expressDelivery: 120,
    dronePhotoshoot: 150,
    droneWedding: 250,
    studioRental: 80,
    flyingDress: 120,
    clearKayak: 100,
  };

  const [eventHours, setEventHours] = useState(2);

  // Watch for URL changes and update service type accordingly
  useEffect(() => {
    const handleURLChange = () => {
      const newServiceType = getServiceTypeFromURL();
      if (newServiceType !== calculation.serviceType) {
        const newState = getInitialState(newServiceType);
        setCalculation(newState);
        // Reset event hours when switching to event service
        if (newServiceType === 'event') {
          setEventHours(packages.event.minimumHours);
        }
      }
    };

    // Listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', handleURLChange);
    // Also listen for custom events when navigation happens programmatically
    window.addEventListener('pushstate', handleURLChange);

    return () => {
      window.removeEventListener('popstate', handleURLChange);
      window.removeEventListener('pushstate', handleURLChange);
    };
  }, [calculation.serviceType]);

  // Automatically calculate total whenever relevant values change
  useEffect(() => {
    let total = calculation.basePrice;
    
    // Add people cost (additional people after first) - only for photoshoots
    if (calculation.serviceType === 'photoshoot' && calculation.peopleCount > 1) {
      total += (calculation.peopleCount - 1) * 50;
    }
    
    // Add transportation
    total += calculation.transportationFee;
    
    // Add addons
    calculation.addons.forEach(addon => {
      if (addon === 'drone') {
        total += calculation.serviceType === 'wedding' ? addonPrices.droneWedding : addonPrices.dronePhotoshoot;
      } else if (addon.startsWith('videography-')) {
        const tier = addon.split('-')[1];
        const price = packages.wedding.videography[tier as keyof typeof packages.wedding.videography];
        if (price) total += price;
      } else if (addonPrices[addon as keyof typeof addonPrices]) {
        total += addonPrices[addon as keyof typeof addonPrices];
      }
    });

    // Only update if the total actually changed to avoid unnecessary re-renders
    if (calculation.totalPrice !== total) {
      setCalculation(prev => ({ ...prev, totalPrice: total }));
    }
  }, [calculation.basePrice, calculation.peopleCount, calculation.transportationFee, calculation.addons, calculation.serviceType]);

  const updateService = useCallback((serviceType: 'photoshoot' | 'wedding' | 'event') => {
    let newPackageType = 'bronze';
    let newBasePrice = 150;

    if (serviceType === 'photoshoot') {
      newBasePrice = packages.photoshoot.bronze.price;
    } else if (serviceType === 'wedding') {
      newBasePrice = packages.wedding.photography.bronze;
    } else if (serviceType === 'event') {
      newBasePrice = packages.event.baseRate * packages.event.minimumHours;
    }

    setCalculation(prev => ({
      ...prev,
      serviceType,
      packageType: newPackageType,
      basePrice: newBasePrice,
      addons: [], // Reset addons when switching service types
    }));

    // Reset event hours when switching to event service
    if (serviceType === 'event') {
      setEventHours(packages.event.minimumHours);
    }
  }, []);

  const updatePackage = useCallback((packageType: string) => {
    let newBasePrice = 150;

    if (calculation.serviceType === 'photoshoot') {
      const pkg = packages.photoshoot[packageType as keyof typeof packages.photoshoot];
      newBasePrice = pkg ? pkg.price : 150;
    } else if (calculation.serviceType === 'wedding') {
      newBasePrice = packages.wedding.photography[packageType as keyof typeof packages.wedding.photography] || 500;
    }

    setCalculation(prev => ({
      ...prev,
      packageType,
      basePrice: newBasePrice,
    }));
  }, [calculation.serviceType]);

  const updatePeople = useCallback((count: number) => {
    setCalculation(prev => ({
      ...prev,
      peopleCount: Math.max(1, count),
    }));
  }, []);

  const updateTransportation = useCallback((fee: number) => {
    setCalculation(prev => ({
      ...prev,
      transportationFee: fee,
    }));
  }, []);

  const toggleAddon = useCallback((addon: string) => {
    setCalculation(prev => {
      const newAddons = prev.addons.includes(addon)
        ? prev.addons.filter(a => a !== addon)
        : [...prev.addons, addon];

      return {
        ...prev,
        addons: newAddons,
      };
    });
  }, []);
  
  const updateEventHours = useCallback((hours: number) => {
    const newHours = Math.max(packages.event.minimumHours, hours);
    setEventHours(newHours);
    
    if (calculation.serviceType === 'event') {
      const newBasePrice = packages.event.baseRate * newHours;
      setCalculation(prev => ({
        ...prev,
        basePrice: newBasePrice,
      }));
    }
  }, [calculation.serviceType]);

  return {
    calculation,
    packages,
    eventHours,
    updateService,
    updatePackage,
    updatePeople,
    updateTransportation,
    updateEventHours,
    toggleAddon,
  };
}
