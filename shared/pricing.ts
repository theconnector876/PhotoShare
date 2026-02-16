export type PricingConfig = {
  packages: {
    photoshoot: {
      photography: {
        bronze: { price: number; duration: number; images: number; locations: number };
        silver: { price: number; duration: number; images: number; locations: number };
        gold: { price: number; duration: number; images: number; locations: number };
        platinum: { price: number; duration: number; images: number; locations: number };
      };
      videography: {
        bronze: number;
        silver: number;
        gold: number;
        platinum: number;
      };
    };
    wedding: {
      photography: {
        bronze: number;
        silver: number;
        gold: number;
        platinum: number;
      };
      videography: {
        bronze: number;
        silver: number;
        gold: number;
        platinum: number;
      };
    };
    event: {
      photography: {
        baseRate: number;
        minimumHours: number;
      };
      videography: {
        baseRate: number;
        minimumHours: number;
      };
    };
  };
  addons: {
    highlightReel: number;
    expressDelivery: number;
    dronePhotoshoot: number;
    droneWedding: number;
    studioRental: number;
    flyingDress: number;
    clearKayak: number;
  };
  fees: {
    additionalPerson: number;
    transportation: {
      manchesterStElizabeth: number;
      montegoBayNegrilOchoRios: number;
      otherParishes: number;
    };
  };
};

export const defaultPricingConfig: PricingConfig = {
  packages: {
    photoshoot: {
      photography: {
        bronze: { price: 150, duration: 45, images: 6, locations: 1 },
        silver: { price: 200, duration: 60, images: 10, locations: 1 },
        gold: { price: 300, duration: 120, images: 15, locations: 1 },
        platinum: { price: 500, duration: 150, images: 25, locations: 2 },
      },
      videography: {
        bronze: 250,
        silver: 350,
        gold: 500,
        platinum: 750,
      },
    },
    wedding: {
      photography: {
        bronze: 500,
        silver: 800,
        gold: 1250,
        platinum: 2500,
      },
      videography: {
        bronze: 600,
        silver: 800,
        gold: 1250,
        platinum: 1800,
      },
    },
    event: {
      photography: {
        baseRate: 150,
        minimumHours: 2,
      },
      videography: {
        baseRate: 100,
        minimumHours: 2,
      },
    },
  },
  addons: {
    highlightReel: 250,
    expressDelivery: 120,
    dronePhotoshoot: 150,
    droneWedding: 250,
    studioRental: 80,
    flyingDress: 120,
    clearKayak: 100,
  },
  fees: {
    additionalPerson: 50,
    transportation: {
      manchesterStElizabeth: 35,
      montegoBayNegrilOchoRios: 50,
      otherParishes: 65,
    },
  },
};
