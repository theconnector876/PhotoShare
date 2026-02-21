import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { defaultSiteConfig, type SiteConfig } from "@shared/site-config";
import { ChevronUp, ChevronDown } from "lucide-react";

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "DM Sans", value: "DM Sans" },
  { label: "Lato", value: "Lato" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Custom", value: "custom" },
];

const splitCommaList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const joinCommaList = (items: string[]) => items.join(", ");

export function AdminSite({ onlySection }: { onlySection?: string | null } = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();

  const { data, isLoading } = useQuery<SiteConfig>({
    queryKey: ["/api/site-config"],
    retry: 2,
  });

  const [config, setConfig] = useState<SiteConfig>(defaultSiteConfig);
  const [layoutHomeOrder, setLayoutHomeOrder] = useState("");
  const [layoutHomeHidden, setLayoutHomeHidden] = useState("");
  const [layoutAboutOrder, setLayoutAboutOrder] = useState("");
  const [layoutAboutHidden, setLayoutAboutHidden] = useState("");
  const [layoutPortfolioOrder, setLayoutPortfolioOrder] = useState("");
  const [layoutPortfolioHidden, setLayoutPortfolioHidden] = useState("");
  const [paragraphsRaw, setParagraphsRaw] = useState("");
  const [extraVarsRaw, setExtraVarsRaw] = useState("{}");
  const [customCssRaw, setCustomCssRaw] = useState("");

  const effectiveConfig = useMemo(() => data || defaultSiteConfig, [data]);

  useEffect(() => {
    setConfig(effectiveConfig);
    setLayoutHomeOrder(joinCommaList(effectiveConfig.layout.home.sectionOrder));
    setLayoutHomeHidden(joinCommaList(effectiveConfig.layout.home.hiddenSections));
    setLayoutAboutOrder(joinCommaList(effectiveConfig.layout.about.sectionOrder));
    setLayoutAboutHidden(joinCommaList(effectiveConfig.layout.about.hiddenSections));
    setLayoutPortfolioOrder(joinCommaList(effectiveConfig.layout.portfolio.sectionOrder));
    setLayoutPortfolioHidden(joinCommaList(effectiveConfig.layout.portfolio.hiddenSections));
    setParagraphsRaw(effectiveConfig.about.paragraphs.join("\n\n"));
    setExtraVarsRaw(JSON.stringify(effectiveConfig.theme.extraVars || {}, null, 2));
    setCustomCssRaw(effectiveConfig.theme.customCss || "");
  }, [effectiveConfig]);

  useEffect(() => {
    if (isLoading) return;
    const scrollToHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;
      const target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [isLoading, location]);

  const updateConfig = (path: string, value: unknown) => {
    setConfig((prev) => {
      const next = { ...prev } as any;
      const keys = path.split(".");
      let current = next;
      keys.slice(0, -1).forEach((key) => {
        current[key] = { ...current[key] };
        current = current[key];
      });
      current[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: SiteConfig) => {
      await apiRequest("/api/admin/site-config", "PUT", { config: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config"] });
      toast({ title: "Site settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save site settings", variant: "destructive" });
    },
  });

  const handleSave = () => {
    let extraVars: Record<string, string> = {};
    try {
      extraVars = JSON.parse(extraVarsRaw || "{}");
    } catch {
      toast({ title: "Extra CSS vars must be valid JSON", variant: "destructive" });
      return;
    }

    const nextConfig: SiteConfig = {
      ...config,
      layout: {
        home: {
          sectionOrder: splitCommaList(layoutHomeOrder),
          hiddenSections: splitCommaList(layoutHomeHidden),
        },
        about: {
          sectionOrder: splitCommaList(layoutAboutOrder),
          hiddenSections: splitCommaList(layoutAboutHidden),
        },
        portfolio: {
          sectionOrder: splitCommaList(layoutPortfolioOrder),
          hiddenSections: splitCommaList(layoutPortfolioHidden),
        },
      },
      about: {
        ...config.about,
        paragraphs: paragraphsRaw
          .split("\n\n")
          .map((paragraph) => paragraph.trim())
          .filter(Boolean),
      },
      theme: {
        ...config.theme,
        extraVars,
        customCss: customCssRaw,
      },
    };

    saveMutation.mutate(nextConfig);
  };

  const addServiceItem = () => {
    updateConfig("home.services.items", [
      ...config.home.services.items,
      { title: "New Service", description: "Service description", priceLabel: "Starting from $0", href: "/booking" },
    ]);
  };

  const addStat = () => {
    updateConfig("about.stats", [...config.about.stats, { value: "0", label: "New Stat" }]);
  };

  const addHighlight = () => {
    updateConfig("about.highlights.items", [
      ...config.about.highlights.items,
      { title: "New Highlight", description: "Highlight description", icon: "fas fa-star" },
    ]);
  };

  // Helper: only show a card if no filter, the id matches exactly, or onlySection is a sub-section of id
  const showSection = (id: string) => !onlySection || onlySection === id || onlySection.startsWith(id + "-");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showSection("site-branding") && <Card id="site-branding">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Update your app name, logo, and general branding.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>App Name</Label>
              <Input
                value={config.branding.appName}
                onChange={(e) => updateConfig("branding.appName", e.target.value)}
              />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input
                value={config.branding.tagline}
                onChange={(e) => updateConfig("branding.tagline", e.target.value)}
              />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input
                value={config.branding.logoUrl}
                onChange={(e) => updateConfig("branding.logoUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Favicon URL</Label>
              <Input
                value={config.branding.faviconUrl}
                onChange={(e) => updateConfig("branding.faviconUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </CardContent>
      </Card>}

      {showSection("site-theme") && <Card id="site-theme">
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Colors, fonts, and base text size.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            {([
              { label: "Primary Color", path: "theme.primary" },
              { label: "Secondary Color", path: "theme.secondary" },
              { label: "Accent Color", path: "theme.accent" },
              { label: "Background Color", path: "theme.background" },
              { label: "Foreground Color", path: "theme.foreground" },
            ] as const).map(({ label, path }) => {
              const rawVal: string = path.split(".").reduce((o: any, k) => o?.[k], config) ?? "";
              return (
                <div key={path}>
                  <Label>{label}</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="color"
                      value={rawVal.startsWith("#") ? rawVal : "#000000"}
                      onChange={(e) => updateConfig(path, e.target.value)}
                      className="w-10 h-9 rounded border cursor-pointer p-0.5"
                    />
                    <Input
                      value={rawVal}
                      onChange={(e) => updateConfig(path, e.target.value)}
                      placeholder="hsl(...) or #hex"
                      className="flex-1"
                    />
                  </div>
                </div>
              );
            })}
            <div>
              <Label>Base Font Size</Label>
              <Input
                value={config.theme.baseFontSize}
                onChange={(e) => updateConfig("theme.baseFontSize", e.target.value)}
                placeholder="16px"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {([
              { label: "Font Sans", path: "theme.fontSans" },
              { label: "Font Serif", path: "theme.fontSerif" },
              { label: "Font Mono", path: "theme.fontMono" },
            ] as const).map(({ label, path }) => {
              const rawVal: string = path.split(".").reduce((o: any, k) => o?.[k], config) ?? "";
              const isKnown = FONT_OPTIONS.some((f) => f.value !== "custom" && f.value === rawVal);
              return (
                <div key={path} className="space-y-1">
                  <Label>{label}</Label>
                  <Select
                    value={isKnown ? rawVal : "custom"}
                    onValueChange={(val) => {
                      if (val !== "custom") updateConfig(path, val);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(!isKnown || rawVal === "") && (
                    <Input
                      value={rawVal}
                      onChange={(e) => updateConfig(path, e.target.value)}
                      placeholder="Custom font name"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <details className="border rounded-md">
            <summary className="cursor-pointer px-4 py-2 font-medium text-sm select-none">Advanced (CSS variables &amp; custom CSS)</summary>
            <div className="p-4 space-y-4">
              <div>
                <Label>Extra CSS Variables (JSON)</Label>
                <Textarea
                  rows={6}
                  value={extraVarsRaw}
                  onChange={(e) => setExtraVarsRaw(e.target.value)}
                  placeholder='{"card":"hsl(0,0%,100%)","primary-foreground":"hsl(210,40%,98%)"}'
                />
              </div>
              <div>
                <Label>Custom CSS</Label>
                <Textarea
                  rows={8}
                  value={customCssRaw}
                  onChange={(e) => setCustomCssRaw(e.target.value)}
                  placeholder=".hero-overlay { opacity: 0.6; }"
                />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>}

      {showSection("site-layout") && <Card id="site-layout">
        <CardHeader>
          <CardTitle>Layout Controls</CardTitle>
          <CardDescription>Adjust section order and visibility.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {([
            { page: "Home", orderState: layoutHomeOrder, setOrder: setLayoutHomeOrder, hiddenState: layoutHomeHidden, setHidden: setLayoutHomeHidden },
            { page: "About", orderState: layoutAboutOrder, setOrder: setLayoutAboutOrder, hiddenState: layoutAboutHidden, setHidden: setLayoutAboutHidden },
            { page: "Portfolio", orderState: layoutPortfolioOrder, setOrder: setLayoutPortfolioOrder, hiddenState: layoutPortfolioHidden, setHidden: setLayoutPortfolioHidden },
          ]).map(({ page, orderState, setOrder, hiddenState, setHidden }) => {
            const sections = splitCommaList(orderState);
            const hidden = splitCommaList(hiddenState);
            const moveSection = (index: number, direction: -1 | 1) => {
              const next = [...sections];
              const target = index + direction;
              if (target < 0 || target >= next.length) return;
              [next[index], next[target]] = [next[target], next[index]];
              setOrder(joinCommaList(next));
            };
            const toggleHidden = (section: string) => {
              const isHidden = hidden.includes(section);
              setHidden(isHidden ? joinCommaList(hidden.filter((s) => s !== section)) : joinCommaList([...hidden, section]));
            };
            return (
              <div key={page}>
                <p className="font-medium text-sm mb-2">{page} Page Sections</p>
                <div className="space-y-1">
                  {sections.map((section, i) => (
                    <div key={section} className="flex items-center gap-2 p-2 rounded border bg-white">
                      <div className="flex flex-col">
                        <button type="button" onClick={() => moveSection(i, -1)} className="hover:text-primary disabled:opacity-30" disabled={i === 0}><ChevronUp className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => moveSection(i, 1)} className="hover:text-primary disabled:opacity-30" disabled={i === sections.length - 1}><ChevronDown className="w-3.5 h-3.5" /></button>
                      </div>
                      <Checkbox
                        id={`${page}-${section}-vis`}
                        checked={!hidden.includes(section)}
                        onCheckedChange={() => toggleHidden(section)}
                      />
                      <label htmlFor={`${page}-${section}-vis`} className="text-sm flex-1 cursor-pointer capitalize">
                        {section}
                        {hidden.includes(section) && <span className="ml-2 text-xs text-muted-foreground">(hidden)</span>}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Raw: {orderState || "(empty)"}</p>
              </div>
            );
          })}
          <p className="text-sm text-muted-foreground">
            Use the arrows to reorder sections. Check to show, uncheck to hide.
          </p>
        </CardContent>
      </Card>}

      {showSection("site-home") && <Card id="site-home">
        <CardHeader>
          <CardTitle>Home Page</CardTitle>
          <CardDescription>Hero text, cover image, and services.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div id="site-home-hero" className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Hero Title</Label>
              <Input
                value={config.home.hero.title}
                onChange={(e) => updateConfig("home.hero.title", e.target.value)}
              />
            </div>
            <div>
              <Label>Hero Highlight</Label>
              <Input
                value={config.home.hero.highlight}
                onChange={(e) => updateConfig("home.hero.highlight", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Hero Subtitle</Label>
              <Textarea
                rows={2}
                value={config.home.hero.subtitle}
                onChange={(e) => updateConfig("home.hero.subtitle", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Hero Cover Image</Label>
              <Input
                value={config.home.hero.coverImage}
                onChange={(e) => updateConfig("home.hero.coverImage", e.target.value)}
              />
            </div>
            <div>
              <Label>Primary CTA Label</Label>
              <Input
                value={config.home.hero.primaryCtaLabel}
                onChange={(e) => updateConfig("home.hero.primaryCtaLabel", e.target.value)}
              />
            </div>
            <div>
              <Label>Primary CTA Href</Label>
              <Input
                value={config.home.hero.primaryCtaHref}
                onChange={(e) => updateConfig("home.hero.primaryCtaHref", e.target.value)}
              />
            </div>
            <div>
              <Label>Secondary CTA Label</Label>
              <Input
                value={config.home.hero.secondaryCtaLabel}
                onChange={(e) => updateConfig("home.hero.secondaryCtaLabel", e.target.value)}
              />
            </div>
            <div>
              <Label>Secondary CTA Href</Label>
              <Input
                value={config.home.hero.secondaryCtaHref}
                onChange={(e) => updateConfig("home.hero.secondaryCtaHref", e.target.value)}
              />
            </div>
          </div>

          <div id="site-home-services" className="space-y-4">
            <div>
              <Label>Services Title</Label>
              <Input
                value={config.home.services.title}
                onChange={(e) => updateConfig("home.services.title", e.target.value)}
              />
            </div>
            <div>
              <Label>Services Subtitle</Label>
              <Input
                value={config.home.services.subtitle}
                onChange={(e) => updateConfig("home.services.subtitle", e.target.value)}
              />
            </div>
            <div className="space-y-3">
              {config.home.services.items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="grid md:grid-cols-2 gap-3">
                  <Input
                    value={item.title}
                    onChange={(e) => {
                      const next = [...config.home.services.items];
                      next[index] = { ...next[index], title: e.target.value };
                      updateConfig("home.services.items", next);
                    }}
                    placeholder="Service title"
                  />
                  <Input
                    value={item.priceLabel}
                    onChange={(e) => {
                      const next = [...config.home.services.items];
                      next[index] = { ...next[index], priceLabel: e.target.value };
                      updateConfig("home.services.items", next);
                    }}
                    placeholder="Price label"
                  />
                  <Input
                    value={item.href}
                    onChange={(e) => {
                      const next = [...config.home.services.items];
                      next[index] = { ...next[index], href: e.target.value };
                      updateConfig("home.services.items", next);
                    }}
                    placeholder="Link"
                    className="md:col-span-2"
                  />
                  <Textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => {
                      const next = [...config.home.services.items];
                      next[index] = { ...next[index], description: e.target.value };
                      updateConfig("home.services.items", next);
                    }}
                    placeholder="Service description"
                    className="md:col-span-2"
                  />
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={addServiceItem}>
              Add Service Item
            </Button>
          </div>

          <div id="site-home-portfolio" className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Portfolio Section Title</Label>
              <Input
                value={config.home.portfolio.title}
                onChange={(e) => updateConfig("home.portfolio.title", e.target.value)}
              />
            </div>
            <div>
              <Label>Portfolio Section Subtitle</Label>
              <Input
                value={config.home.portfolio.subtitle}
                onChange={(e) => updateConfig("home.portfolio.subtitle", e.target.value)}
              />
            </div>
          </div>

          <div id="site-home-reviews" className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Reviews Section Title</Label>
              <Input
                value={config.home.reviews.title}
                onChange={(e) => updateConfig("home.reviews.title", e.target.value)}
              />
            </div>
            <div>
              <Label>Reviews Section Subtitle</Label>
              <Input
                value={config.home.reviews.subtitle}
                onChange={(e) => updateConfig("home.reviews.subtitle", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>}

      {showSection("site-about") && <Card id="site-about">
        <CardHeader>
          <CardTitle>About Page</CardTitle>
          <CardDescription>Copy, stats, and highlight blocks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div id="site-about-main">
            <Label>Title</Label>
            <Input value={config.about.title} onChange={(e) => updateConfig("about.title", e.target.value)} />
          </div>
          <div>
            <Label>Paragraphs (separate with a blank line)</Label>
            <Textarea rows={6} value={paragraphsRaw} onChange={(e) => setParagraphsRaw(e.target.value)} />
          </div>
          <div>
            <Label>About Image</Label>
            <Input value={config.about.image} onChange={(e) => updateConfig("about.image", e.target.value)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Stats</Label>
              <Button variant="outline" onClick={addStat}>
                Add Stat
              </Button>
            </div>
            {config.about.stats.map((stat, index) => (
              <div key={`${stat.label}-${index}`} className="grid md:grid-cols-2 gap-3">
                <Input
                  value={stat.value}
                  onChange={(e) => {
                    const next = [...config.about.stats];
                    next[index] = { ...next[index], value: e.target.value };
                    updateConfig("about.stats", next);
                  }}
                  placeholder="Value"
                />
                <Input
                  value={stat.label}
                  onChange={(e) => {
                    const next = [...config.about.stats];
                    next[index] = { ...next[index], label: e.target.value };
                    updateConfig("about.stats", next);
                  }}
                  placeholder="Label"
                />
              </div>
            ))}
          </div>

          <div id="site-about-mission" className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Mission Title</Label>
              <Input
                value={config.about.mission.title}
                onChange={(e) => updateConfig("about.mission.title", e.target.value)}
              />
            </div>
            <div>
              <Label>Mission Body</Label>
              <Textarea
                rows={2}
                value={config.about.mission.body}
                onChange={(e) => updateConfig("about.mission.body", e.target.value)}
              />
            </div>
          </div>

          <div id="site-about-highlights" className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Highlights</Label>
              <Button variant="outline" onClick={addHighlight}>
                Add Highlight
              </Button>
            </div>
            <div>
              <Label>Highlights Section Title</Label>
              <Input
                value={config.about.highlights.title}
                onChange={(e) => updateConfig("about.highlights.title", e.target.value)}
              />
            </div>
            {config.about.highlights.items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="grid md:grid-cols-2 gap-3">
                <Input
                  value={item.title}
                  onChange={(e) => {
                    const next = [...config.about.highlights.items];
                    next[index] = { ...next[index], title: e.target.value };
                    updateConfig("about.highlights.items", next);
                  }}
                  placeholder="Title"
                />
                <Input
                  value={item.icon}
                  onChange={(e) => {
                    const next = [...config.about.highlights.items];
                    next[index] = { ...next[index], icon: e.target.value };
                    updateConfig("about.highlights.items", next);
                  }}
                  placeholder="Icon class"
                />
                <Textarea
                  rows={2}
                  value={item.description}
                  onChange={(e) => {
                    const next = [...config.about.highlights.items];
                    next[index] = { ...next[index], description: e.target.value };
                    updateConfig("about.highlights.items", next);
                  }}
                  placeholder="Description"
                  className="md:col-span-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>}

      {showSection("site-portfolio") && <Card id="site-portfolio">
        <CardHeader>
          <CardTitle>Portfolio Page</CardTitle>
          <CardDescription>Heading and call-to-action.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div id="site-portfolio-main">
            <Label>Title</Label>
            <Input
              value={config.portfolio.title}
              onChange={(e) => updateConfig("portfolio.title", e.target.value)}
            />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input
              value={config.portfolio.subtitle}
              onChange={(e) => updateConfig("portfolio.subtitle", e.target.value)}
            />
          </div>
          <div id="site-portfolio-cta">
            <Label>CTA Label</Label>
            <Input
              value={config.portfolio.ctaLabel}
              onChange={(e) => updateConfig("portfolio.ctaLabel", e.target.value)}
            />
          </div>
          <div>
            <Label>CTA Href</Label>
            <Input
              value={config.portfolio.ctaHref}
              onChange={(e) => updateConfig("portfolio.ctaHref", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving..." : "Save Site Settings"}
        </Button>
      </div>
    </div>
  );
}
