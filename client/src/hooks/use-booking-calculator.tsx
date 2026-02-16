import { useState, useCallback, useEffect } from "react";
import { defaultPricingConfig, type PricingConfig } from "@shared/pricing";

export interface BookingCalculation {
  serviceType: 'photoshoot' | 'wedding' | 'event';
  packageType: string;
  hasPhotoPackage: boolean;
  hasVideoPackage: boolean;
  videoPackageType: string | null;
  basePrice: number;
  videoPrice: number;
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

function getInitialState(serviceType: 'photoshoot' | 'wedding' | 'event', config: PricingConfig): BookingCalculation {
  let basePrice = 0;
  if (serviceType === 'photoshoot') {
    basePrice = config.packages.photoshoot.photography.bronze.price;
  } else if (serviceType === 'wedding') {
    basePrice = config.packages.wedding.photography.bronze;
  } else {
    basePrice = config.packages.event.photography.baseRate * config.packages.event.photography.minimumHours;
  }

  const transportationFee = config.fees.transportation.manchesterStElizabeth;
  return {
    serviceType,
    packageType: 'bronze',
    hasPhotoPackage: true,
    hasVideoPackage: false,
    videoPackageType: null,
    basePrice,
    videoPrice: 0,
    peopleCount: 1,
    transportationFee,
    addons: [],
    totalPrice: basePrice + transportationFee,
  };
}

export function useBookingCalculator(photographerId?: string) {
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(defaultPricingConfig);
  const [calculation, setCalculation] = useState<BookingCalculation>(() =>
    getInitialState(getServiceTypeFromURL(), defaultPricingConfig)
  );

  const packages = pricingConfig.packages;
  const addonPrices = pricingConfig.addons;

  const [eventHours, setEventHours] = useState(pricingConfig.packages.event.photography.minimumHours);

  useEffect(() => {
    let isMounted = true;
    const loadPricing = async () => {
      try {
        const url = photographerId ? `/api/pricing?photographerId=${encodeURIComponent(photographerId)}` : "/api/pricing";
        const response = await fetch(url);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isMounted && data) {
          setPricingConfig(data);
        }
      } catch (error) {
        console.warn("Failed to load pricing config, using defaults.");
      }
    };

    loadPricing();
    return () => {
      isMounted = false;
    };
  }, [photographerId]);

  useEffect(() => {
    const minHours = pricingConfig.packages.event.photography.minimumHours;
    setEventHours((prev) => Math.max(prev, minHours));
  }, [pricingConfig.packages.event.photography.minimumHours]);

  // Watch for URL changes and update service type accordingly
  useEffect(() => {
    const handleURLChange = () => {
      const newServiceType = getServiceTypeFromURL();
      if (newServiceType !== calculation.serviceType) {
        const newState = getInitialState(newServiceType, pricingConfig);
        setCalculation(newState);
        // Reset event hours when switching to event service
        if (newServiceType === 'event') {
          setEventHours(pricingConfig.packages.event.photography.minimumHours);
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
  }, [calculation.serviceType, pricingConfig]);

  useEffect(() => {
    setCalculation((prev) => {
      let basePrice = prev.basePrice;
      let videoPrice = prev.videoPrice;
      let videoPackageType = prev.videoPackageType;

      if (prev.serviceType === 'photoshoot') {
        basePrice = packages.photoshoot.photography[prev.packageType as keyof typeof packages.photoshoot.photography]?.price || basePrice;
        if (prev.hasVideoPackage) {
          videoPackageType = prev.packageType;
          videoPrice = packages.photoshoot.videography[prev.packageType as keyof typeof packages.photoshoot.videography] || 0;
        }
      } else if (prev.serviceType === 'wedding') {
        basePrice = packages.wedding.photography[prev.packageType as keyof typeof packages.wedding.photography] || basePrice;
        if (prev.hasVideoPackage) {
          videoPackageType = prev.packageType;
          videoPrice = packages.wedding.videography[prev.packageType as keyof typeof packages.wedding.videography] || 0;
        }
      } else {
        basePrice = packages.event.photography.baseRate * eventHours;
        if (prev.hasVideoPackage) {
          videoPrice = packages.event.videography.baseRate * eventHours;
        }
      }

      return {
        ...prev,
        basePrice,
        videoPrice,
        videoPackageType,
      };
    });
  }, [packages, eventHours]);

  // Automatically calculate total whenever relevant values change
  useEffect(() => {
    let total = 0;
    
    // Add photo package price
    if (calculation.hasPhotoPackage) {
      total += calculation.basePrice;
    }
    
    // Add video package price
    if (calculation.hasVideoPackage && calculation.videoPrice) {
      total += calculation.videoPrice;
    }
    
    // Add people cost (additional people after first) - only for photoshoots
    if (calculation.serviceType === 'photoshoot' && calculation.peopleCount > 1) {
      total += (calculation.peopleCount - 1) * pricingConfig.fees.additionalPerson;
    }
    
    // Add transportation
    total += calculation.transportationFee;
    
    // Add addons (excluding the old videography addons since we now have dedicated video packages)
    calculation.addons.forEach(addon => {
      if (addon === 'drone') {
        total += calculation.serviceType === 'wedding' ? addonPrices.droneWedding : addonPrices.dronePhotoshoot;
      } else if (!addon.startsWith('videography-') && addonPrices[addon as keyof typeof addonPrices]) {
        total += addonPrices[addon as keyof typeof addonPrices];
      }
    });

    // Only update if the total actually changed to avoid unnecessary re-renders
    if (calculation.totalPrice !== total) {
      setCalculation(prev => ({ ...prev, totalPrice: total }));
    }
  }, [calculation.basePrice, calculation.videoPrice, calculation.hasPhotoPackage, calculation.hasVideoPackage, calculation.peopleCount, calculation.transportationFee, calculation.addons, calculation.serviceType, pricingConfig.fees.additionalPerson]);

  const updateService = useCallback((serviceType: 'photoshoot' | 'wedding' | 'event') => {
    let newPackageType = 'bronze';
    let newBasePrice = 150;

    if (serviceType === 'photoshoot') {
      newBasePrice = packages.photoshoot.photography.bronze.price;
    } else if (serviceType === 'wedding') {
      newBasePrice = packages.wedding.photography.bronze;
    } else if (serviceType === 'event') {
      newBasePrice = packages.event.photography.baseRate * packages.event.photography.minimumHours;
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
      setEventHours(packages.event.photography.minimumHours);
    }
  }, [packages]);

  const updatePackage = useCallback((packageType: string) => {
    let newBasePrice = 150;
    let newVideoPrice = 0;
    let newVideoPackageType = calculation.videoPackageType;

    if (calculation.serviceType === 'photoshoot') {
      const pkg = packages.photoshoot.photography[packageType as keyof typeof packages.photoshoot.photography];
      newBasePrice = pkg ? pkg.price : 150;
      if (calculation.hasVideoPackage) {
        // Keep video package synced with photo package for pairing (gold photo + gold video)
        newVideoPackageType = packageType;
        newVideoPrice = packages.photoshoot.videography[packageType as keyof typeof packages.photoshoot.videography] || 0;
      }
    } else if (calculation.serviceType === 'wedding') {
      newBasePrice = packages.wedding.photography[packageType as keyof typeof packages.wedding.photography] || 500;
      if (calculation.hasVideoPackage) {
        // Keep video package synced with photo package for pairing (gold photo + gold video)
        newVideoPackageType = packageType;
        newVideoPrice = packages.wedding.videography[packageType as keyof typeof packages.wedding.videography] || 0;
      }
    } else if (calculation.serviceType === 'event') {
      newBasePrice = packages.event.photography.baseRate * eventHours;
      if (calculation.hasVideoPackage) {
        newVideoPrice = packages.event.videography.baseRate * eventHours;
      }
    }

    setCalculation(prev => ({
      ...prev,
      packageType,
      basePrice: newBasePrice,
      videoPrice: newVideoPrice,
      videoPackageType: newVideoPackageType,
    }));
  }, [calculation.serviceType, calculation.hasVideoPackage, calculation.videoPackageType, eventHours, packages]);

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
    const newHours = Math.max(packages.event.photography.minimumHours, hours);
    setEventHours(newHours);
    
    if (calculation.serviceType === 'event') {
      const newBasePrice = packages.event.photography.baseRate * newHours;
      const newVideoPrice = calculation.hasVideoPackage ? packages.event.videography.baseRate * newHours : 0;
      setCalculation(prev => ({
        ...prev,
        basePrice: newBasePrice,
        videoPrice: newVideoPrice,
      }));
    }
  }, [calculation.serviceType, calculation.hasVideoPackage]);

  const toggleVideoPackage = useCallback(() => {
    setCalculation(prev => {
      const hasVideo = !prev.hasVideoPackage;
      let videoPrice = 0;
      let videoPackageType = hasVideo ? prev.packageType : null;

      if (hasVideo) {
        if (prev.serviceType === 'photoshoot') {
          videoPrice = packages.photoshoot.videography[prev.packageType as keyof typeof packages.photoshoot.videography] || 0;
        } else if (prev.serviceType === 'wedding') {
          videoPrice = packages.wedding.videography[prev.packageType as keyof typeof packages.wedding.videography] || 0;
        } else if (prev.serviceType === 'event') {
          videoPrice = packages.event.videography.baseRate * eventHours;
        }
      }

      return {
        ...prev,
        hasVideoPackage: hasVideo,
        videoPackageType,
        videoPrice,
      };
    });
  }, [eventHours]);

  const updateVideoPackage = useCallback((videoPackageType: string) => {
    let newVideoPrice = 0;

    if (calculation.serviceType === 'photoshoot') {
      newVideoPrice = packages.photoshoot.videography[videoPackageType as keyof typeof packages.photoshoot.videography] || 0;
    } else if (calculation.serviceType === 'wedding') {
      newVideoPrice = packages.wedding.videography[videoPackageType as keyof typeof packages.wedding.videography] || 0;
    } else if (calculation.serviceType === 'event') {
      newVideoPrice = packages.event.videography.baseRate * eventHours;
    }

    setCalculation(prev => ({
      ...prev,
      videoPackageType,
      videoPrice: newVideoPrice,
    }));
  }, [calculation.serviceType, eventHours]);

  return {
    calculation,
    packages,
    pricingConfig,
    eventHours,
    updateService,
    updatePackage,
    updatePeople,
    updateTransportation,
    updateEventHours,
    toggleAddon,
    toggleVideoPackage,
    updateVideoPackage,
  };
}
