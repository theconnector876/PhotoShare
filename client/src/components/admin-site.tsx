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
import { Separator } from "@/components/ui/separator";
import { defaultSiteConfig, type SiteConfig } from "@shared/site-config";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "DM Sans", value: "DM Sans" },
  { label: "Lato", value: "Lato" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Custom", value: "custom" },
];

const NAV_SECTIONS = [
  { id: "site-branding", label: "Branding" },
  { id: "site-theme", label: "Theme" },
  { id: "site-layout", label: "Layout" },
  { id: "site-home", label: "Home" },
  { id: "site-about", label: "About" },
  { id: "site-portfolio", label: "Portfolio" },
];

const splitCommaList = (value: string) =>
  value.split(",").map((item) => item.trim()).filter(Boolean);

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
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
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
        home: { sectionOrder: splitCommaList(layoutHomeOrder), hiddenSections: splitCommaList(layoutHomeHidden) },
        about: { sectionOrder: splitCommaList(layoutAboutOrder), hiddenSections: splitCommaList(layoutAboutHidden) },
        portfolio: { sectionOrder: splitCommaList(layoutPortfolioOrder), hiddenSections: splitCommaList(layoutPortfolioHidden) },
      },
      about: {
        ...config.about,
        paragraphs: paragraphsRaw.split("\n\n").map((p) => p.trim()).filter(Boolean),
      },
      theme: { ...config.theme, extraVars, customCss: customCssRaw },
    };
    saveMutation.mutate(nextConfig);
  };

  // List item helpers
  const addServiceItem = () =>
    updateConfig("home.services.items", [
      ...config.home.services.items,
      { title: "New Service", description: "Service description", priceLabel: "Starting from $0", href: "/booking" },
    ]);
  const removeServiceItem = (i: number) =>
    updateConfig("home.services.items", config.home.services.items.filter((_, idx) => idx !== i));

  const addStat = () =>
    updateConfig("about.stats", [...config.about.stats, { value: "0", label: "New Stat" }]);
  const removeStat = (i: number) =>
    updateConfig("about.stats", config.about.stats.filter((_, idx) => idx !== i));

  const addHighlight = () =>
    updateConfig("about.highlights.items", [
      ...config.about.highlights.items,
      { title: "New Highlight", description: "Highlight description", icon: "fas fa-star" },
    ]);
  const removeHighlight = (i: number) =>
    updateConfig("about.highlights.items", config.about.highlights.items.filter((_, idx) => idx !== i));

  // Section visibility helpers
  // showSection: show the card at all?
  const showSection = (id: string) =>
    !onlySection || onlySection === id || onlySection.startsWith(id + "-");

  // showSubSection: within a card, show only the matching sub-block?
  const showSubSection = (subId: string) => {
    if (!onlySection) return true;
    if (onlySection === subId) return true;
    // onlySection is a parent (e.g. "site-about" → show all site-about-* children)
    if (subId.startsWith(onlySection + "-")) return true;
    return false;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Jump-nav — only shown when not in focus mode */}
      {!onlySection && (
        <div className="flex flex-wrap gap-2 pb-2 border-b sticky top-0 bg-background z-10 pt-1">
          {NAV_SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                const el = document.getElementById(id);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="px-3 py-1 text-xs font-medium rounded-full border bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── BRANDING ─────────────────────────────────────── */}
      {showSection("site-branding") && (
        <Card id="site-branding">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Branding</CardTitle>
            <CardDescription>App name, tagline, logo and favicon.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>App Name</Label>
              <Input value={config.branding.appName} onChange={(e) => updateConfig("branding.appName", e.target.value)} />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input value={config.branding.tagline} onChange={(e) => updateConfig("branding.tagline", e.target.value)} />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={config.branding.logoUrl} onChange={(e) => updateConfig("branding.logoUrl", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Favicon URL</Label>
              <Input value={config.branding.faviconUrl} onChange={(e) => updateConfig("branding.faviconUrl", e.target.value)} placeholder="https://..." />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── THEME ────────────────────────────────────────── */}
      {showSection("site-theme") && (
        <Card id="site-theme">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Theme</CardTitle>
            <CardDescription>Colors, fonts, and advanced CSS.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Colors */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Colors</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {([
                  { label: "Primary", path: "theme.primary" },
                  { label: "Secondary", path: "theme.secondary" },
                  { label: "Accent", path: "theme.accent" },
                  { label: "Background", path: "theme.background" },
                  { label: "Foreground", path: "theme.foreground" },
                ] as const).map(({ label, path }) => {
                  const rawVal: string = path.split(".").reduce((o: any, k) => o?.[k], config) ?? "";
                  return (
                    <div key={path}>
                      <Label className="text-xs">{label}</Label>
                      <div className="flex gap-2 items-center mt-1">
                        <input
                          type="color"
                          value={rawVal.startsWith("#") ? rawVal : "#000000"}
                          onChange={(e) => updateConfig(path, e.target.value)}
                          className="w-10 h-9 rounded border cursor-pointer p-0.5 shrink-0"
                        />
                        <Input
                          value={rawVal}
                          onChange={(e) => updateConfig(path, e.target.value)}
                          placeholder="#hex or hsl(...)"
                          className="flex-1 font-mono text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
                <div>
                  <Label className="text-xs">Base Font Size</Label>
                  <Input
                    value={config.theme.baseFontSize}
                    onChange={(e) => updateConfig("theme.baseFontSize", e.target.value)}
                    placeholder="16px"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Fonts */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-3">Fonts</p>
              <div className="grid md:grid-cols-3 gap-4">
                {([
                  { label: "Sans Font", path: "theme.fontSans" },
                  { label: "Serif Font", path: "theme.fontSerif" },
                  { label: "Mono Font", path: "theme.fontMono" },
                ] as const).map(({ label, path }) => {
                  const rawVal: string = path.split(".").reduce((o: any, k) => o?.[k], config) ?? "";
                  const isKnown = FONT_OPTIONS.some((f) => f.value !== "custom" && f.value === rawVal);
                  return (
                    <div key={path} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Select
                        value={isKnown ? rawVal : "custom"}
                        onValueChange={(val) => { if (val !== "custom") updateConfig(path, val); }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(!isKnown || rawVal === "") && (
                        <Input value={rawVal} onChange={(e) => updateConfig(path, e.target.value)} placeholder="Custom font name" className="text-xs" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Advanced */}
            <details className="border rounded-md">
              <summary className="cursor-pointer px-4 py-2 font-medium text-sm select-none text-muted-foreground">
                ▸ Advanced (CSS variables &amp; custom CSS)
              </summary>
              <div className="p-4 space-y-4">
                <div>
                  <Label>Extra CSS Variables (JSON)</Label>
                  <Textarea rows={5} value={extraVarsRaw} onChange={(e) => setExtraVarsRaw(e.target.value)} className="font-mono text-xs mt-1" placeholder='{"card":"hsl(0,0%,100%)"}' />
                </div>
                <div>
                  <Label>Custom CSS</Label>
                  <Textarea rows={7} value={customCssRaw} onChange={(e) => setCustomCssRaw(e.target.value)} className="font-mono text-xs mt-1" placeholder=".hero-overlay { opacity: 0.6; }" />
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* ── LAYOUT ───────────────────────────────────────── */}
      {showSection("site-layout") && (
        <Card id="site-layout">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Layout Controls</CardTitle>
            <CardDescription>Section order and visibility per page.</CardDescription>
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
                  <p className="font-medium text-sm mb-2 text-muted-foreground">{page} Page</p>
                  <div className="space-y-1">
                    {sections.map((section, i) => (
                      <div key={section} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${hidden.includes(section) ? "opacity-50 bg-muted" : "bg-card"}`}>
                        <div className="flex flex-col gap-0.5">
                          <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="hover:text-primary disabled:opacity-20 leading-none"><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="hover:text-primary disabled:opacity-20 leading-none"><ChevronDown className="w-3.5 h-3.5" /></button>
                        </div>
                        <Checkbox id={`${page}-${section}`} checked={!hidden.includes(section)} onCheckedChange={() => toggleHidden(section)} />
                        <label htmlFor={`${page}-${section}`} className="flex-1 cursor-pointer capitalize">{section}</label>
                        {hidden.includes(section) && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">hidden</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── HOME PAGE ────────────────────────────────────── */}
      {showSection("site-home") && (
        <Card id="site-home">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Home Page</CardTitle>
            <CardDescription>Hero, services, portfolio preview and reviews sections.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Hero */}
            <div id="site-home-hero">
              {showSubSection("site-home-hero") && (
                <>
                  <p className="text-sm font-semibold mb-3 text-primary">Hero Section</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Title</Label>
                      <Input value={config.home.hero.title} onChange={(e) => updateConfig("home.hero.title", e.target.value)} />
                    </div>
                    <div>
                      <Label>Highlight (gradient text)</Label>
                      <Input value={config.home.hero.highlight} onChange={(e) => updateConfig("home.hero.highlight", e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Subtitle</Label>
                      <Textarea rows={2} value={config.home.hero.subtitle} onChange={(e) => updateConfig("home.hero.subtitle", e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Cover Image URL</Label>
                      <Input value={config.home.hero.coverImage} onChange={(e) => updateConfig("home.hero.coverImage", e.target.value)} />
                    </div>
                    <div>
                      <Label>Primary Button Label</Label>
                      <Input value={config.home.hero.primaryCtaLabel} onChange={(e) => updateConfig("home.hero.primaryCtaLabel", e.target.value)} />
                    </div>
                    <div>
                      <Label>Primary Button Link</Label>
                      <Input value={config.home.hero.primaryCtaHref} onChange={(e) => updateConfig("home.hero.primaryCtaHref", e.target.value)} />
                    </div>
                    <div>
                      <Label>Secondary Button Label</Label>
                      <Input value={config.home.hero.secondaryCtaLabel} onChange={(e) => updateConfig("home.hero.secondaryCtaLabel", e.target.value)} />
                    </div>
                    <div>
                      <Label>Secondary Button Link</Label>
                      <Input value={config.home.hero.secondaryCtaHref} onChange={(e) => updateConfig("home.hero.secondaryCtaHref", e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {showSubSection("site-home-hero") && showSubSection("site-home-services") && <Separator />}

            {/* Services */}
            <div id="site-home-services">
              {showSubSection("site-home-services") && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-primary">Services Section</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Section Title</Label>
                      <Input value={config.home.services.title} onChange={(e) => updateConfig("home.services.title", e.target.value)} />
                    </div>
                    <div>
                      <Label>Section Subtitle</Label>
                      <Input value={config.home.services.subtitle} onChange={(e) => updateConfig("home.services.subtitle", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {config.home.services.items.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">Service {index + 1}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeServiceItem(index)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2">
                          <Input value={item.title} onChange={(e) => { const next = [...config.home.services.items]; next[index] = { ...next[index], title: e.target.value }; updateConfig("home.services.items", next); }} placeholder="Service title" />
                          <Input value={item.priceLabel} onChange={(e) => { const next = [...config.home.services.items]; next[index] = { ...next[index], priceLabel: e.target.value }; updateConfig("home.services.items", next); }} placeholder="Price label" />
                          <Input value={item.href} onChange={(e) => { const next = [...config.home.services.items]; next[index] = { ...next[index], href: e.target.value }; updateConfig("home.services.items", next); }} placeholder="Link" className="md:col-span-2" />
                          <Textarea rows={2} value={item.description} onChange={(e) => { const next = [...config.home.services.items]; next[index] = { ...next[index], description: e.target.value }; updateConfig("home.services.items", next); }} placeholder="Service description" className="md:col-span-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addServiceItem} className="gap-2">
                    <Plus className="w-3.5 h-3.5" /> Add Service
                  </Button>
                </div>
              )}
            </div>

            {showSubSection("site-home-services") && showSubSection("site-home-portfolio") && <Separator />}

            {/* Portfolio preview */}
            <div id="site-home-portfolio">
              {showSubSection("site-home-portfolio") && (
                <>
                  <p className="text-sm font-semibold mb-3 text-primary">Portfolio Section</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Section Title</Label>
                      <Input value={config.home.portfolio.title} onChange={(e) => updateConfig("home.portfolio.title", e.target.value)} />
                    </div>
                    <div>
                      <Label>Section Subtitle</Label>
                      <Input value={config.home.portfolio.subtitle} onChange={(e) => updateConfig("home.portfolio.subtitle", e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {showSubSection("site-home-portfolio") && showSubSection("site-home-reviews") && <Separator />}

            {/* Reviews */}
            <div id="site-home-reviews">
              {showSubSection("site-home-reviews") && (
                <>
                  <p className="text-sm font-semibold mb-3 text-primary">Reviews Section</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Section Title</Label>
                      <Input value={config.home.reviews.title} onChange={(e) => updateConfig("home.reviews.title", e.target.value)} />
                    </div>
                    <div>
                      <Label>Section Subtitle</Label>
                      <Input value={config.home.reviews.subtitle} onChange={(e) => updateConfig("home.reviews.subtitle", e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── ABOUT PAGE ───────────────────────────────────── */}
      {showSection("site-about") && (
        <Card id="site-about">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">About Page</CardTitle>
            <CardDescription>Main content, mission statement, and highlights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Main about content */}
            <div id="site-about-main">
              {showSubSection("site-about-main") && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-primary">Main Content</p>
                  <div>
                    <Label>Page Title</Label>
                    <Input value={config.about.title} onChange={(e) => updateConfig("about.title", e.target.value)} />
                  </div>
                  <div>
                    <Label>Paragraphs <span className="text-muted-foreground font-normal text-xs">(separate with a blank line)</span></Label>
                    <Textarea rows={6} value={paragraphsRaw} onChange={(e) => setParagraphsRaw(e.target.value)} />
                  </div>
                  <div>
                    <Label>About Image URL</Label>
                    <Input value={config.about.image} onChange={(e) => updateConfig("about.image", e.target.value)} />
                  </div>

                  {/* Stats */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Stats</Label>
                      <Button variant="outline" size="sm" onClick={addStat} className="gap-1 h-7 text-xs">
                        <Plus className="w-3 h-3" /> Add Stat
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {config.about.stats.map((stat, index) => (
                        <div key={`${stat.label}-${index}`} className="flex gap-2 items-center">
                          <Input value={stat.value} onChange={(e) => { const next = [...config.about.stats]; next[index] = { ...next[index], value: e.target.value }; updateConfig("about.stats", next); }} placeholder="Value (e.g. 500+)" className="flex-1" />
                          <Input value={stat.label} onChange={(e) => { const next = [...config.about.stats]; next[index] = { ...next[index], label: e.target.value }; updateConfig("about.stats", next); }} placeholder="Label" className="flex-1" />
                          <Button variant="ghost" size="sm" onClick={() => removeStat(index)} className="h-9 w-9 p-0 text-destructive hover:text-destructive shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {showSubSection("site-about-main") && showSubSection("site-about-mission") && <Separator />}

            {/* Mission */}
            <div id="site-about-mission">
              {showSubSection("site-about-mission") && (
                <>
                  <p className="text-sm font-semibold mb-3 text-primary">Mission Statement</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Mission Title</Label>
                      <Input value={config.about.mission.title} onChange={(e) => updateConfig("about.mission.title", e.target.value)} />
                    </div>
                    <div>
                      <Label>Mission Body</Label>
                      <Textarea rows={3} value={config.about.mission.body} onChange={(e) => updateConfig("about.mission.body", e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </div>

            {showSubSection("site-about-mission") && showSubSection("site-about-highlights") && <Separator />}

            {/* Highlights */}
            <div id="site-about-highlights">
              {showSubSection("site-about-highlights") && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-primary">Highlights</p>
                  <div>
                    <Label>Section Title</Label>
                    <Input value={config.about.highlights.title} onChange={(e) => updateConfig("about.highlights.title", e.target.value)} />
                  </div>
                  <div className="space-y-3">
                    {config.about.highlights.items.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">Highlight {index + 1}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeHighlight(index)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-2">
                          <Input value={item.title} onChange={(e) => { const next = [...config.about.highlights.items]; next[index] = { ...next[index], title: e.target.value }; updateConfig("about.highlights.items", next); }} placeholder="Title" />
                          <Input value={item.icon} onChange={(e) => { const next = [...config.about.highlights.items]; next[index] = { ...next[index], icon: e.target.value }; updateConfig("about.highlights.items", next); }} placeholder="Icon class (e.g. fas fa-star)" />
                          <Textarea rows={2} value={item.description} onChange={(e) => { const next = [...config.about.highlights.items]; next[index] = { ...next[index], description: e.target.value }; updateConfig("about.highlights.items", next); }} placeholder="Description" className="md:col-span-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addHighlight} className="gap-2">
                    <Plus className="w-3.5 h-3.5" /> Add Highlight
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── PORTFOLIO PAGE ───────────────────────────────── */}
      {showSection("site-portfolio") && (
        <Card id="site-portfolio">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Portfolio Page</CardTitle>
            <CardDescription>Heading and call-to-action.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div id="site-portfolio-main">
              {showSubSection("site-portfolio-main") && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Title</Label>
                    <Input value={config.portfolio.title} onChange={(e) => updateConfig("portfolio.title", e.target.value)} />
                  </div>
                  <div>
                    <Label>Subtitle</Label>
                    <Input value={config.portfolio.subtitle} onChange={(e) => updateConfig("portfolio.subtitle", e.target.value)} />
                  </div>
                </div>
              )}
            </div>
            {showSubSection("site-portfolio-main") && showSubSection("site-portfolio-cta") && <Separator />}
            <div id="site-portfolio-cta">
              {showSubSection("site-portfolio-cta") && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>CTA Button Label</Label>
                    <Input value={config.portfolio.ctaLabel} onChange={(e) => updateConfig("portfolio.ctaLabel", e.target.value)} />
                  </div>
                  <div>
                    <Label>CTA Button Link</Label>
                    <Input value={config.portfolio.ctaHref} onChange={(e) => updateConfig("portfolio.ctaHref", e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="min-w-32">
          {saveMutation.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
