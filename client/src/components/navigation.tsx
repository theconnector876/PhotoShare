import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Camera, Menu, X, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useSiteConfig } from "@/context/site-config";

export default function Navigation() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logoutMutation } = useAuth();
  const { config } = useSiteConfig();

  const publicNavItems = [
    { href: "/", label: "Home" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/booking", label: "Book Now" },
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
  ] : [
    ...publicNavItems,
    { href: "/auth", label: "Login" },
  ];

  const handleLogout = () => {
    logoutMutation.mutate();
    setIsOpen(false);
  };

  const NavLink = ({ href, label, mobile = false }: { href: string; label: string; mobile?: boolean }) => {
    const isActive = location === href;
    const baseClasses = mobile 
      ? "block px-3 py-2 text-lg font-medium transition-colors duration-300"
      : "nav-link relative px-2 py-2 text-sm font-medium text-foreground transition-all duration-300 magnetic-btn whitespace-nowrap";
    
    const activeClasses = isActive 
      ? "text-primary" 
      : mobile 
        ? "text-muted-foreground hover:text-primary" 
        : "hover:text-primary";

    return (
      <Link href={href}>
        <span className={`${baseClasses} ${activeClasses}`} onClick={() => mobile && setIsOpen(false)}>
          {label}
          {!mobile && <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-jamaica-green to-jamaica-yellow transition-all duration-300 group-hover:w-full"></span>}
        </span>
      </Link>
    );
  };

  return (
    <nav className="fixed top-0 w-full bg-card/80 backdrop-blur-lg border-b border-border z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-4 cursor-pointer group" data-testid="logo-link">
              {config.branding.logoUrl ? (
                <img
                  src={config.branding.logoUrl}
                  alt={config.branding.appName}
                  className="w-10 h-10 rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-jamaica-green to-jamaica-yellow flex items-center justify-center group-hover:rotate-12 transition-transform duration-300">
                  <Camera className="text-white text-lg" />
                </div>
              )}
              <span className="text-xl font-bold gradient-text font-serif">{config.branding.appName}</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            {authNavItems.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
            {user && (
              <div className="flex items-center gap-3 pl-2 border-l border-border/60">
                <span className="text-xs text-muted-foreground hidden lg:inline">
                  Hi, {user.firstName || user.email}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {logoutMutation.isPending ? "Logging out..." : "Logout"}
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground hover:text-primary magnetic-btn" data-testid="mobile-menu-button">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col space-y-4 mt-8">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-3">
                      {config.branding.logoUrl ? (
                        <img
                          src={config.branding.logoUrl}
                          alt={config.branding.appName}
                          className="w-8 h-8 rounded-full object-cover shadow-sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-jamaica-green to-jamaica-yellow flex items-center justify-center">
                          <Camera className="text-white text-sm" />
                        </div>
                      )}
                      <span className="text-lg font-bold gradient-text font-serif">{config.branding.appName}</span>
                    </div>
                  </div>
                  
                  {authNavItems.map((item) => (
                    <NavLink key={item.href} {...item} mobile />
                  ))}
                  
                  {user && (
                    <div className="pt-4 border-t border-border">
                      <div className="mb-4 text-sm text-muted-foreground">
                        Hi, {user.firstName || user.email}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                        data-testid="mobile-logout-button"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {logoutMutation.isPending ? "Logging out..." : "Logout"}
                      </Button>
                    </div>
                  )}

                  <div className="pt-6 border-t border-border">
                    <Link href="/gallery">
                      <Button 
                        className="w-full bg-gradient-to-r from-jamaica-green to-jamaica-yellow text-white font-semibold magnetic-btn"
                        onClick={() => setIsOpen(false)}
                        data-testid="mobile-gallery-access-button"
                      >
                        Gallery Access
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
