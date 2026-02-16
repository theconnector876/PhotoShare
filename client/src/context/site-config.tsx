import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { defaultSiteConfig, type SiteConfig } from "@shared/site-config";

type SiteConfigContextValue = {
  config: SiteConfig;
  isLoading: boolean;
  refresh: () => void;
};

const SiteConfigContext = createContext<SiteConfigContextValue | undefined>(undefined);

const applyTheme = (config: SiteConfig) => {
  const root = document.documentElement;
  const { theme } = config;

  root.style.setProperty("--primary", theme.primary);
  root.style.setProperty("--secondary", theme.secondary);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--background", theme.background);
  root.style.setProperty("--foreground", theme.foreground);
  root.style.setProperty("--font-sans", theme.fontSans);
  root.style.setProperty("--font-serif", theme.fontSerif);
  root.style.setProperty("--font-mono", theme.fontMono);

  if (theme.baseFontSize) {
    root.style.fontSize = theme.baseFontSize;
  }

  Object.entries(theme.extraVars || {}).forEach(([key, value]) => {
    if (!key.startsWith("--")) {
      root.style.setProperty(`--${key}`, value);
    } else {
      root.style.setProperty(key, value);
    }
  });
};

const applyBranding = (config: SiteConfig) => {
  if (config.branding.appName) {
    document.title = config.branding.appName;
  }

  if (config.branding.faviconUrl) {
    const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (existing) {
      existing.href = config.branding.faviconUrl;
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = config.branding.faviconUrl;
      document.head.appendChild(link);
    }
  }
};

const applyCustomCss = (css: string) => {
  const styleId = "site-custom-css";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = css || "";
};

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SiteConfig>({
    queryKey: ["/api/site-config"],
    retry: 2,
  });

  const config = useMemo(() => data || defaultSiteConfig, [data]);

  useEffect(() => {
    applyTheme(config);
    applyBranding(config);
    applyCustomCss(config.theme.customCss);
  }, [config]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/site-config"] });
  };

  return (
    <SiteConfigContext.Provider value={{ config, isLoading, refresh }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const context = useContext(SiteConfigContext);
  if (!context) {
    throw new Error("useSiteConfig must be used within SiteConfigProvider");
  }
  return context;
}
