import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { SignOut, CaretDown, Bell, BellSlash, X, List, Camera as CameraIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useSiteConfig } from "@/context/site-config";
import { useCurrency } from "@/context/currency";
import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS, type Currency } from "@shared/currency";
import { usePush } from "@/hooks/use-push";
import { motion, AnimatePresence } from "framer-motion";

// Walk elements at a screen point to find the first opaque background,
// skipping any element matching the given data-attribute skip key.
function sampleLuminanceAt(cx: number, cy: number, skipAttr: string): boolean {
  try {
    const els = document.elementsFromPoint(cx, cy);
    for (const el of els) {
      const he = el as HTMLElement;
      if (he.dataset?.[skipAttr] || he.closest(`[data-${skipAttr}]`)) continue;
      let node: Element | null = el;
      while (node && node !== document.documentElement) {
        const bg = window.getComputedStyle(node).backgroundColor;
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (m) {
          const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
          if (alpha < 0.15) { node = node.parentElement; continue; }
          const [r, g, b] = [+m[1], +m[2], +m[3]];
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
        }
        node = node.parentElement;
      }
    }
  } catch { /* ignore */ }
  return !document.documentElement.classList.contains('dark');
}

// Sample page background behind the mobile menu overlay (center of screen)
function samplePageIsLight(): boolean {
  return sampleLuminanceAt(window.innerWidth / 2, window.innerHeight / 2, 'menuOverlay');
}

// Sample page background behind the nav bar (top of page, y=32 = nav midpoint)
function sampleNavIsLight(): boolean {
  return sampleLuminanceAt(window.innerWidth / 2, 32, 'navBar');
}

export default function Navigation() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [menuOnLight, setMenuOnLight] = useState(false);
  const [navOnLight, setNavOnLight] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logoutMutation } = useAuth();
  const { config } = useSiteConfig();
  const { selectedCurrency, setCurrency } = useCurrency();
  const { permission, subscribed, loading: pushLoading, supported: pushSupported, subscribe, unsubscribe } = usePush();

  // Scroll detection + transparent-nav background sampling
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      setScrolled(isScrolled);
      // Only need background detection when nav is transparent (not scrolled)
      if (!isScrolled) setNavOnLight(sampleNavIsLight());
    };
    handleScroll(); // initial sample on mount
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  const openMenu = () => {
    setMenuOnLight(samplePageIsLight());
    setIsOpen(true);
  };

  // Continuously re-sample background while menu is open via rAF loop.
  // rAF works even when the fixed overlay absorbs scroll/touch events —
  // it polls every frame so the color flips the moment content shifts behind it.
  useEffect(() => {
    if (!isOpen) return;
    let rafId: number;
    let last = -1;
    const tick = () => {
      // Only call setState when the result actually changes (avoid excessive renders)
      const isLight = samplePageIsLight() ? 1 : 0;
      if (isLight !== last) {
        last = isLight;
        setMenuOnLight(isLight === 1);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  const publicNavItems = [
    { href: "/", label: "Home" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  const dashboardLink = user?.role === "photographer"
    ? { href: "/photographer", label: "Dashboard" }
    : { href: "/dashboard", label: "Dashboard" };

  const authNavItems = user ? [
    ...publicNavItems,
    dashboardLink,
    ...(user.isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ] : publicNavItems;

  const handleLogout = () => {
    logoutMutation.mutate();
    setIsOpen(false);
  };

  return (
    <>
      {/* ── Desktop / top nav ── */}
      <nav
        data-nav-bar="true"
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 dark:bg-[#070709]/95 backdrop-blur-xl shadow-sm border-b border-black/5 dark:border-white/[0.04]'
            : 'bg-gradient-to-b from-black/50 via-black/15 to-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">

            {/* ── Logo ── */}
            <Link href="/">
              <div className="flex items-center gap-2.5 cursor-pointer shrink-0" data-testid="logo-link">
                <div className="w-8 h-8 rounded-[10px] bg-amber-500 flex items-center justify-center overflow-hidden shadow-lg shadow-amber-500/25">
                  <img
                    src="/logo-white.png"
                    alt={config.branding.appName}
                    className="w-12 h-12 object-contain scale-[1.6]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <CameraIcon size={16} className="text-black absolute opacity-0" />
                </div>
                <span
                  className={`font-bold text-[15px] tracking-tight transition-colors duration-300 ${
                    scrolled
                      ? 'text-gray-900 dark:text-white'
                      : navOnLight
                        ? 'text-gray-900'
                        : 'text-white drop-shadow-md'
                  }`}
                  style={{ fontFamily: 'var(--font-display, var(--font-sans))' }}
                >
                  {config.branding.appName}
                </span>
              </div>
            </Link>

            {/* ── Desktop nav links ── */}
            <div className="hidden md:flex items-center gap-6">
              {authNavItems.map((item, idx) => {
                const isActive = location === item.href;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 + 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Link href={item.href}>
                      <span
                        className={`nav-link relative text-[13px] font-medium transition-colors duration-300 pb-1 drop-shadow-sm ${
                          isActive
                            ? 'active text-amber-500'
                            : scrolled
                              ? 'text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
                              : navOnLight
                                ? 'text-gray-800 hover:text-gray-950'
                                : 'text-white/95 hover:text-white'
                        }`}
                      >
                        {item.label}
                        {isActive && (
                          <motion.span
                            layoutId="nav-underline"
                            className="absolute -bottom-0.5 left-0 right-0 h-[1.5px] bg-amber-500 rounded-full"
                          />
                        )}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Desktop right actions ── */}
            <div className="hidden md:flex items-center gap-2">
              {/* Currency switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-8 text-[12px] gap-1 px-2.5 rounded-lg transition-colors ${
                      scrolled
                        ? 'text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6'
                        : navOnLight
                          ? 'text-gray-500 hover:text-gray-900 hover:bg-black/6'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {CURRENCY_SYMBOLS[selectedCurrency]} {selectedCurrency}
                    <CaretDown size={12} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[140px] bg-white dark:bg-[#141414] border-gray-200 dark:border-white/8 rounded-xl p-1 shadow-lg"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <DropdownMenuItem
                      key={c}
                      onClick={() => setCurrency(c as Currency)}
                      className={`rounded-lg text-sm cursor-pointer ${
                        selectedCurrency === c
                          ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/8"
                          : "text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                      }`}
                    >
                      {CURRENCY_SYMBOLS[c as Currency]} {c}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Push notifications */}
              {user && pushSupported && permission !== "denied" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`w-8 h-8 rounded-lg transition-colors ${
                        scrolled
                          ? 'text-gray-400 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6'
                          : navOnLight
                            ? 'text-gray-400 hover:text-gray-900 hover:bg-black/6'
                            : 'text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                      disabled={pushLoading}
                      onClick={subscribed ? unsubscribe : subscribe}
                      aria-label={subscribed ? "Disable notifications" : "Enable notifications"}
                    >
                      {subscribed
                        ? <Bell size={15} weight="fill" className="text-amber-500" />
                        : <BellSlash size={15} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-gray-900 dark:bg-[#1a1a1a] text-white border-gray-700 dark:border-white/10 text-xs">
                    {subscribed ? "Notifications on — click to disable" : "Enable push notifications"}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Logged-in user / login */}
              {user ? (
                <div className={`flex items-center gap-2 pl-2 border-l ${scrolled ? 'border-gray-200 dark:border-white/8' : navOnLight ? 'border-black/10' : 'border-white/15'}`}>
                  <span className={`text-[11px] hidden lg:inline ${scrolled ? 'text-gray-400 dark:text-white/35' : navOnLight ? 'text-gray-400' : 'text-white/40'}`}>
                    Hi, {user.firstName || user.email}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className={`h-8 text-[12px] rounded-lg transition-colors ${
                      scrolled
                        ? 'text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6'
                        : navOnLight
                          ? 'text-gray-500 hover:text-gray-900 hover:bg-black/6'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    data-testid="button-logout"
                  >
                    <SignOut size={14} className="mr-1.5" />
                    {logoutMutation.isPending ? "Logging out…" : "Logout"}
                  </Button>
                </div>
              ) : (
                <Link href="/auth">
                  <Button
                    size="sm"
                    className={`h-8 text-[12px] border-0 rounded-full px-4 transition-colors ${
                      scrolled
                        ? 'bg-gray-100 dark:bg-white/8 hover:bg-gray-200 dark:hover:bg-white/12 text-gray-700 dark:text-white'
                        : navOnLight
                          ? 'bg-black/8 hover:bg-black/14 text-gray-800'
                          : 'bg-white/12 hover:bg-white/20 text-white'
                    }`}
                  >
                    Login
                  </Button>
                </Link>
              )}

              {/* Book Now CTA */}
              <Link href="/booking" data-testid="nav-book-now">
                <Button
                  size="sm"
                  className="h-8 text-[12px] bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-5 shadow-md shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:shadow-lg"
                >
                  Book Now
                </Button>
              </Link>
            </div>

            {/* ── Mobile ── */}
            <div className="md:hidden flex items-center gap-2">
              <Link href="/booking">
                <Button
                  size="sm"
                  className="h-7 text-[12px] bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-3.5"
                >
                  Book
                </Button>
              </Link>
              <button
                onClick={() => isOpen ? setIsOpen(false) : openMenu()}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  scrolled
                    ? 'text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/6'
                    : navOnLight
                      ? 'text-gray-700 hover:bg-black/8'
                      : 'text-white/80 hover:bg-white/10'
                }`}
                aria-label="Toggle menu"
                data-testid="mobile-menu-button"
              >
                <List size={18} />
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* ── Mobile full-screen overlay menu ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            data-menu-overlay="true"
            className={`fixed inset-0 z-[60] flex flex-col backdrop-blur-2xl transition-colors duration-300 ${
              menuOnLight ? 'bg-white/92' : 'bg-[#070709]/97'
            }`}
          >
            {/* Close button + logo */}
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-amber-500 flex items-center justify-center overflow-hidden shadow-lg shadow-amber-500/25">
                  <CameraIcon size={16} className="text-black" weight="duotone" />
                </div>
                <span
                  className={`font-bold text-[15px] tracking-tight ${menuOnLight ? 'text-gray-900' : 'text-white'}`}
                  style={{ fontFamily: 'var(--font-display, var(--font-sans))' }}
                >
                  {config.branding.appName}
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  menuOnLight
                    ? 'bg-black/6 hover:bg-black/10 text-gray-700'
                    : 'bg-white/6 hover:bg-white/10 text-white/70'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items — staggered */}
            <div className="flex-1 flex flex-col justify-center px-6">
              <nav className="space-y-1">
                {authNavItems.map((item, idx) => {
                  const isActive = location === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link href={item.href}>
                        <span
                          className={`flex items-center justify-between px-4 py-4 rounded-2xl text-[22px] font-bold tracking-tight transition-colors cursor-pointer ${
                            isActive
                              ? 'text-amber-500 bg-amber-500/10'
                              : menuOnLight
                                ? 'text-gray-800 hover:text-gray-900 hover:bg-black/5'
                                : 'text-white/85 hover:text-white hover:bg-white/6'
                          }`}
                          style={{ fontFamily: 'var(--font-display, var(--font-sans))' }}
                          onClick={() => setIsOpen(false)}
                        >
                          {item.label}
                          {isActive && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}

                {/* Gallery access */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: authNavItems.length * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href="/gallery">
                    <span
                      className={`flex items-center px-4 py-4 rounded-2xl text-[22px] font-bold tracking-tight transition-colors cursor-pointer ${
                        menuOnLight
                          ? 'text-gray-800 hover:text-gray-900 hover:bg-black/5'
                          : 'text-white/85 hover:text-white hover:bg-white/6'
                      }`}
                      style={{ fontFamily: 'var(--font-display, var(--font-sans))' }}
                      onClick={() => setIsOpen(false)}
                      data-testid="mobile-gallery-access-button"
                    >
                      Gallery
                    </span>
                  </Link>
                </motion.div>
              </nav>
            </div>

            {/* Bottom actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="px-6 pb-10 space-y-4"
            >
              {/* Currency */}
              <div className={`border-t pt-5 ${menuOnLight ? 'border-black/8' : 'border-white/[0.06]'}`}>
                <p className={`text-[11px] font-semibold tracking-[0.2em] uppercase mb-3 ${menuOnLight ? 'text-gray-400' : 'text-white/25'}`}>Currency</p>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c as Currency)}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                        selectedCurrency === c
                          ? "bg-amber-500 text-black"
                          : menuOnLight
                            ? "bg-black/6 text-gray-600 hover:bg-black/10 hover:text-gray-900"
                            : "bg-white/8 text-white/60 hover:bg-white/15 hover:text-white"
                      }`}
                    >
                      {CURRENCY_SYMBOLS[c as Currency]} {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* User */}
              {user ? (
                <div className={`border-t pt-4 flex items-center justify-between ${menuOnLight ? 'border-black/8' : 'border-white/[0.06]'}`}>
                  <span className={`text-[13px] ${menuOnLight ? 'text-gray-400' : 'text-white/40'}`}>Hi, {user.firstName || user.email}</span>
                  <button
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                    className={`flex items-center gap-2 text-[13px] transition-colors ${
                      menuOnLight ? 'text-gray-500 hover:text-gray-900' : 'text-white/50 hover:text-white'
                    }`}
                    data-testid="mobile-logout-button"
                  >
                    <SignOut size={16} />
                    {logoutMutation.isPending ? "Logging out…" : "Logout"}
                  </button>
                </div>
              ) : (
                <div className={`border-t pt-4 ${menuOnLight ? 'border-black/8' : 'border-white/[0.06]'}`}>
                  <Link href="/auth">
                    <Button
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-2xl h-12 text-[15px]"
                      onClick={() => setIsOpen(false)}
                    >
                      Login / Register
                    </Button>
                  </Link>
                </div>
              )}

              {/* Push notifications */}
              {user && pushSupported && permission !== "denied" && (
                <button
                  onClick={subscribed ? unsubscribe : subscribe}
                  disabled={pushLoading}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] transition-colors ${
                    menuOnLight
                      ? 'text-gray-500 hover:text-gray-900 hover:bg-black/5'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {subscribed
                    ? <Bell size={16} weight="fill" className="text-amber-500" />
                    : <BellSlash size={16} />}
                  {subscribed ? "Notifications on" : "Enable notifications"}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
