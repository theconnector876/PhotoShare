import { useState, useCallback } from "react";

export interface BookingCalculation {
  serviceType: 'photoshoot' | 'wedding' | 'event';
  packageType: string;
  basePrice: number;
  peopleCount: number;
  transportationFee: number;
  addons: string[];
  totalPrice: number;
}

export function useBookingCalculator() {
  const [calculation, setCalculation] = useState<BookingCalculation>({
    serviceType: 'photoshoot',
    packageType: 'bronze',
    basePrice: 150,
    peopleCount: 1,
    transportationFee: 35,
    addons: [],
    totalPrice: 185,
  });

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

  const calculateTotal = useCallback(() => {
    let total = calculation.basePrice;
    
    // Add people cost (additional people after first)
    if (calculation.peopleCount > 1) {
      total += (calculation.peopleCount - 1) * 50;
    }
    
    // Add transportation
    total += calculation.transportationFee;
    
    // Add addons
    calculation.addons.forEach(addon => {
      if (addon === 'drone') {
        total += calculation.serviceType === 'wedding' ? addonPrices.droneWedding : addonPrices.dronePhotoshoot;
      } else if (addonPrices[addon as keyof typeof addonPrices]) {
        total += addonPrices[addon as keyof typeof addonPrices];
      }
    });

    return total;
  }, [calculation]);

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
      totalPrice: calculateTotal(),
    }));
  }, [calculateTotal]);

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
      totalPrice: calculateTotal(),
    }));
  }, [calculation.serviceType, calculateTotal]);

  const updatePeople = useCallback((count: number) => {
    setCalculation(prev => ({
      ...prev,
      peopleCount: Math.max(1, count),
      totalPrice: calculateTotal(),
    }));
  }, [calculateTotal]);

  const updateTransportation = useCallback((fee: number) => {
    setCalculation(prev => ({
      ...prev,
      transportationFee: fee,
      totalPrice: calculateTotal(),
    }));
  }, [calculateTotal]);

  const toggleAddon = useCallback((addon: string) => {
    setCalculation(prev => {
      const newAddons = prev.addons.includes(addon)
        ? prev.addons.filter(a => a !== addon)
        : [...prev.addons, addon];

      return {
        ...prev,
        addons: newAddons,
        totalPrice: calculateTotal(),
      };
    });
  }, [calculateTotal]);

  // Update total whenever calculation changes
  useState(() => {
    setCalculation(prev => ({
      ...prev,
      totalPrice: calculateTotal(),
    }));
  });

  return {
    calculation,
    packages,
    updateService,
    updatePackage,
    updatePeople,
    updateTransportation,
    toggleAddon,
    calculateTotal,
  };
}
