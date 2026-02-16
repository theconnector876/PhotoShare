export type SiteConfig = {
  branding: {
    appName: string;
    tagline: string;
    logoUrl: string;
    faviconUrl: string;
  };
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    fontSans: string;
    fontSerif: string;
    fontMono: string;
    baseFontSize: string;
    extraVars: Record<string, string>;
    customCss: string;
  };
  layout: {
    home: { sectionOrder: string[]; hiddenSections: string[] };
    about: { sectionOrder: string[]; hiddenSections: string[] };
    portfolio: { sectionOrder: string[]; hiddenSections: string[] };
  };
  home: {
    hero: {
      title: string;
      highlight: string;
      subtitle: string;
      coverImage: string;
      primaryCtaLabel: string;
      primaryCtaHref: string;
      secondaryCtaLabel: string;
      secondaryCtaHref: string;
    };
    services: {
      title: string;
      subtitle: string;
      items: Array<{ title: string; description: string; priceLabel: string; href: string }>;
    };
    portfolio: { title: string; subtitle: string };
    reviews: { title: string; subtitle: string };
  };
  about: {
    title: string;
    paragraphs: string[];
    stats: Array<{ value: string; label: string }>;
    image: string;
    mission: { title: string; body: string };
    highlights: {
      title: string;
      items: Array<{ title: string; description: string; icon: string }>;
    };
  };
  portfolio: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
  };
};

export const defaultSiteConfig: SiteConfig = {
  branding: {
    appName: "Connectagrapher",
    tagline: "Capture Your Perfect Moment",
    logoUrl: "",
    faviconUrl: "",
  },
  theme: {
    primary: "hsl(120, 100%, 20%)",
    secondary: "hsl(51, 100%, 50%)",
    accent: "hsl(42, 100%, 62%)",
    background: "hsl(210, 40%, 98%)",
    foreground: "hsl(222, 84%, 5%)",
    fontSans: "'Inter', system-ui, sans-serif",
    fontSerif: "'Playfair Display', serif",
    fontMono: "Menlo, monospace",
    baseFontSize: "16px",
    extraVars: {},
    customCss: "",
  },
  layout: {
    home: {
      sectionOrder: ["hero", "services", "portfolio", "reviews"],
      hiddenSections: [],
    },
    about: {
      sectionOrder: ["about", "mission", "highlights"],
      hiddenSections: [],
    },
    portfolio: {
      sectionOrder: ["portfolio", "cta"],
      hiddenSections: [],
    },
  },
  home: {
    hero: {
      title: "Capture Your",
      highlight: "Perfect Moment",
      subtitle: "Professional Photography Services across Beautiful Jamaica",
      coverImage: "/uploads/_ATC9768_4.jpg",
      primaryCtaLabel: "Book Your Session",
      primaryCtaHref: "/booking",
      secondaryCtaLabel: "View Portfolio",
      secondaryCtaHref: "/portfolio",
    },
    services: {
      title: "Our Services",
      subtitle: "Professional photography and videography services for every special moment",
      items: [
        {
          title: "Portrait Sessions",
          description: "Personal and professional portraits in stunning Jamaican locations",
          priceLabel: "Starting from $150",
          href: "/booking?service=photoshoot",
        },
        {
          title: "Wedding Photography",
          description: "Capture your special day with our comprehensive wedding packages",
          priceLabel: "Starting from $500",
          href: "/booking?service=wedding",
        },
        {
          title: "Event Photography",
          description: "Professional coverage for corporate events, parties, and celebrations",
          priceLabel: "Starting from $150/hour",
          href: "/booking?service=event",
        },
      ],
    },
    portfolio: {
      title: "Featured Work",
      subtitle: "A glimpse into our portfolio of captured memories",
    },
    reviews: {
      title: "What Our Clients Say",
      subtitle: "Real experiences from real clients who trusted us with their special moments",
    },
  },
  about: {
    title: "About The Connector",
    paragraphs: [
      "Based in the heart of Jamaica, The Connector Photography specializes in capturing life's most precious moments against the backdrop of our beautiful island. From intimate portrait sessions on pristine beaches to grand wedding celebrations in lush tropical settings.",
      "With years of experience and a passion for storytelling through imagery, we bring creativity, professionalism, and the vibrant spirit of Jamaica to every session.",
    ],
    stats: [
      { value: "500+", label: "Sessions Completed" },
      { value: "50+", label: "Weddings Captured" },
      { value: "5★", label: "Client Rating" },
      { value: "14", label: "Parishes Covered" },
    ],
    image: "/uploads/_ATC8022_1.jpg",
    mission: {
      title: "Our Mission",
      body: "To preserve your most cherished memories through the art of photography, celebrating the natural beauty of Jamaica while creating timeless images that tell your unique story. We believe every moment deserves to be captured with passion, creativity, and professional excellence.",
    },
    highlights: {
      title: "What Sets Us Apart",
      items: [
        {
          title: "Local Expertise",
          description: "Deep knowledge of Jamaica's most breathtaking locations and hidden gems for the perfect backdrop.",
          icon: "fas fa-map-marked-alt",
        },
        {
          title: "Professional Quality",
          description: "State-of-the-art equipment and advanced post-processing techniques ensure stunning results every time.",
          icon: "fas fa-award",
        },
        {
          title: "Personal Service",
          description: "Tailored approach to each client, ensuring your vision and personality shine through in every image.",
          icon: "fas fa-heart",
        },
      ],
    },
  },
  portfolio: {
    title: "Our Portfolio",
    subtitle: "Explore our collection of captured moments across Jamaica's most beautiful locations",
    ctaLabel: "Book Your Session Now",
    ctaHref: "/booking",
  },
};
