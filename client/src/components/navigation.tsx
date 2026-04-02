import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, LogOut, ChevronDown, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useSiteConfig } from "@/context/site-config";
import { useCurrency } from "@/context/currency";
import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS, type Currency } from "@shared/currency";
import { usePush } from "@/hooks/use-push";

export default function Navigation() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logoutMutation } = useAuth();
  const { config } = useSiteConfig();
  const { selectedCurrency, setCurrency } = useCurrency();
  const { permission, subscribed, loading: pushLoading, supported: pushSupported, subscribe, unsubscribe } = usePush();

  const publicNavItems = [
    { href: "/", label: "Home" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  const dashboardLink = user?.role === "photographer"
    ? { href: "/photographer", label: "Photographer" }
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

  const NavLink = ({ href, label, mobile = false }: { href: string; label: string; mobile?: boolean }) => {
    const isActive = location === href;
    if (mobile) {
      return (
        <Link href={href}>
          <span
            className={`flex items-center px-4 py-3 text-[15px] font-medium rounded-xl transition-colors ${
              isActive
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "text-gray-600 dark:text-white/65 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
            }`}
            onClick={() => setIsOpen(false)}
          >
            {label}
          </span>
        </Link>
      );
    }
    return (
      <Link href={href}>
        <span
          className={`text-[13px] font-medium transition-colors whitespace-nowrap ${
            isActive
              ? "text-amber-600 dark:text-amber-400"
              : "text-gray-500 dark:text-white/55 hover:text-gray-900 dark:hover:text-white"
          }`}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/90 dark:bg-black/85 backdrop-blur-2xl border-b border-gray-200/80 dark:border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">

          {/* ── Logo ── */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer shrink-0" data-testid="logo-link">
              <div className="w-8 h-8 rounded-[10px] bg-amber-500 flex items-center justify-center overflow-hidden shadow-lg shadow-amber-500/20">
                <img src="/logo-white.png" alt={config.branding.appName} className="w-12 h-12 object-contain scale-[1.6]" />
              </div>
              <span className="text-gray-900 dark:text-white font-bold text-[15px] tracking-tight">{config.branding.appName}</span>
            </div>
          </Link>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-5">
            {authNavItems.map(item => <NavLink key={item.href} {...item} />)}
          </div>

          {/* ── Desktop right actions ── */}
          <div className="hidden md:flex items-center gap-2">
            {/* Currency switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-[12px] text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6 gap-1 px-2.5 rounded-lg"
                >
                  {CURRENCY_SYMBOLS[selectedCurrency]} {selectedCurrency}
                  <ChevronDown className="w-3 h-3" />
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
                    className="w-8 h-8 rounded-lg text-gray-400 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6"
                    disabled={pushLoading}
                    onClick={subscribed ? unsubscribe : subscribe}
                    aria-label={subscribed ? "Disable notifications" : "Enable notifications"}
                  >
                    {subscribed
                      ? <Bell className="w-[15px] h-[15px] text-amber-500" />
                      : <BellOff className="w-[15px] h-[15px]" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-gray-900 dark:bg-[#1a1a1a] text-white border-gray-700 dark:border-white/10 text-xs">
                  {subscribed ? "Notifications on — click to disable" : "Enable push notifications"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Logged-in user / login */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-white/8">
                <span className="text-[11px] text-gray-400 dark:text-white/35 hidden lg:inline">
                  Hi, {user.firstName || user.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  className="h-8 text-[12px] text-gray-500 dark:text-white/45 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6 rounded-lg"
                  data-testid="button-logout"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" />
                  {logoutMutation.isPending ? "Logging out…" : "Logout"}
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button
                  size="sm"
                  className="h-8 text-[12px] bg-gray-100 dark:bg-white/8 hover:bg-gray-200 dark:hover:bg-white/12 text-gray-700 dark:text-white border-0 rounded-full px-4"
                >
                  Login
                </Button>
              </Link>
            )}

            {/* Book Now CTA */}
            <Link href="/booking" data-testid="nav-book-now">
              <Button
                size="sm"
                className="h-8 text-[12px] bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-5 shadow-md shadow-amber-500/20 transition-all"
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
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-lg text-gray-500 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/6"
                  data-testid="mobile-menu-button"
                >
                  <Menu className="h-[18px] w-[18px]" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[270px] bg-white dark:bg-[#0d0d0d] border-gray-200 dark:border-white/[0.06] p-0">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-100 dark:border-white/[0.06]">
                    <div className="w-7 h-7 rounded-[9px] bg-amber-500 flex items-center justify-center overflow-hidden">
                      <img src="/logo-white.png" alt={config.branding.appName} className="w-10 h-10 object-contain scale-[1.6]" />
                    </div>
                    <span className="text-gray-900 dark:text-white font-semibold text-[14px]">{config.branding.appName}</span>
                  </div>

                  {/* Nav items */}
                  <div className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
                    {authNavItems.map(item => <NavLink key={item.href} {...item} mobile />)}
                    <Link href="/gallery">
                      <span
                        className="flex items-center px-4 py-3 text-[15px] font-medium rounded-xl text-gray-600 dark:text-white/65 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        onClick={() => setIsOpen(false)}
                        data-testid="mobile-gallery-access-button"
                      >
                        Gallery Access
                      </span>
                    </Link>
                  </div>

                  {/* Currency (mobile) */}
                  <div className="px-3 pb-2 border-t border-gray-100 dark:border-white/[0.06] pt-3">
                    <p className="text-gray-400 dark:text-white/30 text-[11px] uppercase tracking-wider px-4 mb-2">Currency</p>
                    <div className="flex flex-wrap gap-1.5 px-2">
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <button
                          key={c}
                          onClick={() => setCurrency(c as Currency)}
                          className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                            selectedCurrency === c
                              ? "bg-amber-500 text-black"
                              : "bg-gray-100 dark:bg-white/6 text-gray-600 dark:text-white/60 hover:bg-gray-200 dark:hover:bg-white/10"
                          }`}
                        >
                          {CURRENCY_SYMBOLS[c as Currency]} {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* User actions */}
                  {user ? (
                    <div className="px-3 pb-4 border-t border-gray-100 dark:border-white/[0.06] pt-3 space-y-1">
                      <p className="text-gray-400 dark:text-white/30 text-[11px] px-4 mb-2">
                        Hi, {user.firstName || user.email}
                      </p>
                      {pushSupported && permission !== "denied" && (
                        <button
                          onClick={subscribed ? unsubscribe : subscribe}
                          disabled={pushLoading}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-white/65 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 text-[14px] transition-colors"
                        >
                          {subscribed
                            ? <Bell className="w-4 h-4 text-amber-500" />
                            : <BellOff className="w-4 h-4" />}
                          {subscribed ? "Notifications on" : "Enable notifications"}
                        </button>
                      )}
                      <button
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 dark:text-white/65 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 text-[14px] transition-colors"
                        data-testid="mobile-logout-button"
                      >
                        <LogOut className="w-4 h-4" />
                        {logoutMutation.isPending ? "Logging out…" : "Logout"}
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 pb-4 border-t border-gray-100 dark:border-white/[0.06] pt-3">
                      <Link href="/auth">
                        <Button
                          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl"
                          onClick={() => setIsOpen(false)}
                        >
                          Login / Register
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

        </div>
      </div>
    </nav>
  );
}
