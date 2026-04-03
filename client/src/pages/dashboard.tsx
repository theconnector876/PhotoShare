import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarBlank, Download, Eye, Camera, Clock, MapPin, Phone, EnvelopeSimple,
  SignOut, ArrowRight, ChatCircleDots, User, Images, BookOpen, Star,
  Sparkle, Aperture, FilmStrip, Lightning, TrendUp, Confetti, CheckCircle
} from "@phosphor-icons/react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { ChatPanel } from "@/components/chat-panel";
import { UserProfileForm } from "@/components/user-profile-form";
import { motion } from "framer-motion";

interface UserBooking {
  id: string;
  clientName: string;
  email: string;
  contactNumber: string;
  serviceType: string;
  packageType: string;
  numberOfPeople: number;
  shootDate: string;
  shootTime: string;
  location: string;
  parish: string;
  totalPrice: number;
  depositAmount: number;
  balanceDue: number;
  depositPaid: boolean;
  balancePaid: boolean;
  depositTransactionId: string | null;
  balanceTransactionId: string | null;
  status: string;
  createdAt: string;
}

interface UserGallery {
  id: string;
  bookingId: string;
  clientEmail: string;
  accessCode: string;
  status: string;
  galleryImages: string[];
  selectedImages: string[];
  finalImages: string[];
  createdAt: string;
}

const STATUS_CONFIG = {
  pending:   { label: "Pending",   cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400" },
  confirmed: { label: "Confirmed", cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400" },
  unread:    { label: "Unread",    cls: "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-400" },
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  wedding:    <Confetti size={20} weight="duotone" className="text-rose-400" />,
  event:      <Star size={20} weight="duotone" className="text-amber-400" />,
  photoshoot: <Camera size={20} weight="duotone" className="text-blue-400" />,
};

export default function Dashboard() {
  const { user, isLoading: authLoading, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("bookings");
  const isChat = activeTab === "chat";

  const { data: userBookings, isLoading: bookingsLoading } = useQuery<UserBooking[]>({
    queryKey: ["/api/user/bookings"],
    enabled: !!user,
    retry: false,
  });

  const { data: userGalleries, isLoading: galleriesLoading } = useQuery<UserGallery[]>({
    queryKey: ["/api/user/galleries"],
    enabled: !!user,
    retry: false,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/conversations/unread-count"],
    refetchInterval: 4000,
    enabled: !!user,
    retry: false,
  });
  const unreadCount = unreadData?.count ?? 0;

  const isAdmin = user?.isAdmin || false;
  const { data: adminContacts } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts"],
    enabled: !!user && isAdmin,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !user) setLocation("/auth");
    if (!authLoading && user?.role === "photographer") setLocation("/photographer");
  }, [authLoading, user, setLocation]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Aperture size={40} className="text-amber-500 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const getStatusCfg = (status: string) =>
    STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? { label: status, cls: "bg-muted text-muted-foreground" };

  const getServiceIcon = (serviceType: string) =>
    SERVICE_ICONS[serviceType] ?? <Camera size={20} weight="duotone" className="text-muted-foreground" />;

  return (
    <div className={isChat ? "h-screen overflow-hidden flex flex-col pt-16 bg-background relative z-10" : "pt-24 pb-24 bg-background relative z-10"}>
      <div className={isChat ? "flex flex-col flex-1 min-h-0 max-w-6xl w-full mx-auto px-4" : "max-w-6xl mx-auto px-4"}>

        {/* ── Header ── */}
        <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 ${isChat ? "mb-3 flex-shrink-0" : "mb-10"}`}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber-500 mb-1.5 flex items-center gap-1.5">
              <Sparkle size={11} weight="fill" /> {isAdmin ? "Admin Console" : "Client Portal"}
            </p>
            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-display, var(--font-serif))' }}
            >
              {isAdmin ? "Admin Dashboard" : `Welcome back, ${user?.firstName || "there"}!`}
            </h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {isAdmin
                ? "Manage all bookings, galleries, and customer inquiries"
                : "Manage your photography bookings and access your galleries"}
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="gap-2 rounded-full h-9 px-4 text-sm"
              data-testid="button-logout"
            >
              <SignOut size={15} />
              {logoutMutation.isPending ? "Signing out…" : "Sign Out"}
            </Button>
          </motion.div>
        </div>

        {/* ── Admin stat cards ── */}
        {isAdmin && !isChat && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Overview</h2>
              <Button size="sm" onClick={() => setLocation("/admin")} className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-full h-8 px-4 text-xs font-bold">
                Full Admin Panel <ArrowRight size={13} weight="bold" />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: <CalendarBlank size={22} weight="duotone" className="text-amber-500" />, value: userBookings?.length ?? 0, label: "Bookings", tab: "bookings" },
                { icon: <Images size={22} weight="duotone" className="text-blue-400" />, value: userGalleries?.length ?? 0, label: "Galleries", tab: "galleries" },
                { icon: <EnvelopeSimple size={22} weight="duotone" className="text-violet-400" />, value: Array.isArray(adminContacts) ? adminContacts.length : 0, label: "Messages", tab: "contacts" },
                { icon: <TrendUp size={22} weight="duotone" className="text-emerald-400" />, value: "—", label: "Catalogues", tab: "catalogues" },
              ].map((stat) => (
                <Card
                  key={stat.label}
                  className="p-4 cursor-pointer hover:shadow-md hover:border-amber-500/30 transition-all duration-200 group rounded-2xl"
                  onClick={() => stat.tab === "catalogues" ? setLocation("/admin?tab=catalogues") : setActiveTab(stat.tab)}
                >
                  <div className="flex items-start justify-between mb-2">
                    {stat.icon}
                    <ArrowRight size={13} className="text-muted-foreground/40 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <div className="text-2xl font-extrabold tracking-tight text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className={isChat ? "flex flex-col flex-1 min-h-0" : "space-y-6"}>
          <TabsList className={`grid w-full rounded-2xl ${isAdmin ? 'grid-cols-3' : 'grid-cols-4'}${isChat ? " flex-shrink-0" : ""}`}>
            <TabsTrigger value="bookings" className="rounded-xl text-sm gap-1.5" data-testid="tab-bookings">
              <CalendarBlank size={15} weight="duotone" />
              {isAdmin ? "All Bookings" : "My Bookings"}
            </TabsTrigger>
            <TabsTrigger value="galleries" className="rounded-xl text-sm gap-1.5" data-testid="tab-galleries">
              <Images size={15} weight="duotone" />
              {isAdmin ? "All Galleries" : "My Galleries"}
            </TabsTrigger>
            {isAdmin ? (
              <TabsTrigger value="contacts" className="rounded-xl text-sm gap-1.5" data-testid="tab-contacts">
                <EnvelopeSimple size={15} weight="duotone" />
                Contact Messages
              </TabsTrigger>
            ) : (
              <>
                <TabsTrigger value="chat" className="relative rounded-xl text-sm gap-1.5" data-testid="tab-chat">
                  <ChatCircleDots size={15} weight="duotone" />
                  Chat
                  {unreadCount > 0 && (
                    <span className="ml-0.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{unreadCount}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="profile" className="rounded-xl text-sm gap-1.5" data-testid="tab-profile">
                  <User size={15} weight="duotone" />
                  Profile
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* ── Bookings tab ── */}
          <TabsContent value="bookings" className="space-y-4 mt-4">
            {bookingsLoading ? (
              <div className="flex justify-center py-16"><Aperture size={32} className="text-amber-500 animate-spin" /></div>
            ) : !userBookings || userBookings.length === 0 ? (
              <Card className="py-16 text-center rounded-2xl border-dashed">
                <Camera size={48} weight="duotone" className="mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No bookings yet</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">Ready to capture your special moments? Book a session with us!</p>
                <Button onClick={() => setLocation("/booking")} className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full px-6" data-testid="button-book-session">
                  Book a Session
                </Button>
              </Card>
            ) : (
              userBookings.map((booking, i) => {
                const sc = getStatusCfg(booking.status);
                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.35 }}
                  >
                    <Card className="rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-amber-500/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              {getServiceIcon(booking.serviceType)}
                            </div>
                            <div>
                              <CardTitle className="text-base">
                                {booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1)} — {booking.packageType}
                              </CardTitle>
                              <CardDescription className="text-xs mt-0.5">Booked {formatDate(booking.createdAt)}</CardDescription>
                            </div>
                          </div>
                          <Badge className={`${sc.cls} rounded-full text-[11px] px-2.5 py-0.5 font-semibold shrink-0`} data-testid={`status-${booking.id}`}>
                            {sc.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <CalendarBlank size={14} weight="duotone" className="text-amber-500 shrink-0" />
                              <span>{formatDate(booking.shootDate)} at {booking.shootTime}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin size={14} weight="duotone" className="text-amber-500 shrink-0" />
                              <span>{booking.location}, {booking.parish}</span>
                            </div>
                            {booking.numberOfPeople > 1 && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User size={14} weight="duotone" className="text-amber-500 shrink-0" />
                                <span>{booking.numberOfPeople} people</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone size={14} weight="duotone" className="text-amber-500 shrink-0" />
                              <span>{booking.contactNumber}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <EnvelopeSimple size={14} weight="duotone" className="text-amber-500 shrink-0" />
                              <span>{booking.email}</span>
                            </div>
                            <div className="pt-1">
                              <span className="text-base font-bold text-foreground">${booking.totalPrice}</span>
                              <div className="flex gap-3 mt-1.5">
                                <span className={`text-xs flex items-center gap-1 ${booking.depositPaid ? 'text-emerald-500' : 'text-amber-500'}`}>
                                  <CheckCircle size={11} weight={booking.depositPaid ? "fill" : "regular"} />
                                  Deposit {booking.depositPaid ? "Paid" : "Due"}
                                </span>
                                <span className={`text-xs flex items-center gap-1 ${booking.balancePaid ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                                  <CheckCircle size={11} weight={booking.balancePaid ? "fill" : "regular"} />
                                  Balance {booking.balancePaid ? "Paid" : booking.depositPaid ? "Due" : "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </TabsContent>

          {/* ── Galleries tab ── */}
          <TabsContent value="galleries" className="space-y-4 mt-4">
            {galleriesLoading ? (
              <div className="flex justify-center py-16"><Aperture size={32} className="text-amber-500 animate-spin" /></div>
            ) : !userGalleries || userGalleries.length === 0 ? (
              <Card className="py-16 text-center rounded-2xl border-dashed">
                <FilmStrip size={48} weight="duotone" className="mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No galleries yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">Your galleries will appear here after your photoshoot is completed.</p>
              </Card>
            ) : (
              userGalleries.map((gallery, i) => {
                const sc = getStatusCfg(gallery.status);
                return (
                  <motion.div
                    key={gallery.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.35 }}
                  >
                    <Card className="rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-amber-500/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <FilmStrip size={20} weight="duotone" className="text-amber-500" />
                            </div>
                            <div>
                              <CardTitle className="text-base">Gallery #{gallery.id.slice(-8)}</CardTitle>
                              <CardDescription className="text-xs mt-0.5">Created {formatDate(gallery.createdAt)}</CardDescription>
                            </div>
                          </div>
                          <Badge className={`${sc.cls} rounded-full text-[11px] px-2.5 py-0.5 font-semibold shrink-0`}>
                            {sc.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {[
                            { icon: <Images size={16} weight="duotone" className="text-amber-500" />, count: gallery.galleryImages?.length ?? 0, label: "Gallery" },
                            { icon: <Star size={16} weight="duotone" className="text-blue-400" />, count: gallery.selectedImages?.length ?? 0, label: "Selected" },
                            { icon: <CheckCircle size={16} weight="duotone" className="text-emerald-400" />, count: gallery.finalImages?.length ?? 0, label: "Final" },
                          ].map((stat) => (
                            <div key={stat.label} className="bg-muted/50 rounded-xl p-3 text-center">
                              <div className="flex justify-center mb-1">{stat.icon}</div>
                              <div className="text-xl font-bold text-foreground">{stat.count}</div>
                              <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {gallery.galleryImages?.length > 0 && (
                            <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-xs h-8"
                              onClick={() => setLocation(`/gallery/${encodeURIComponent(gallery.clientEmail)}/${gallery.accessCode}`)}
                              data-testid={`button-view-gallery-${gallery.id}`}
                            >
                              <Eye size={13} weight="duotone" /> Open Gallery
                            </Button>
                          )}
                          {gallery.finalImages?.length > 0 && (
                            <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full gap-1.5 text-xs h-8"
                              onClick={() => setLocation(`/gallery/${encodeURIComponent(gallery.clientEmail)}/${gallery.accessCode}`)}
                              data-testid={`button-download-final-${gallery.id}`}
                            >
                              <Download size={13} weight="duotone" /> View Finals
                            </Button>
                          )}
                          {gallery.galleryImages?.length === 0 && (
                            <span className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                              <Clock size={12} /> Awaiting photo upload
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </TabsContent>

          {/* ── Admin contacts ── */}
          {isAdmin && (
            <TabsContent value="contacts" className="space-y-4 mt-4">
              {!adminContacts || (Array.isArray(adminContacts) && adminContacts.length === 0) ? (
                <Card className="py-16 text-center rounded-2xl border-dashed">
                  <EnvelopeSimple size={48} weight="duotone" className="mx-auto text-muted-foreground/40 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No contact messages</h3>
                  <p className="text-muted-foreground text-sm">No client inquiries have been received yet.</p>
                </Card>
              ) : Array.isArray(adminContacts) ? (
                adminContacts.map((contact: any, i: number) => {
                  const sc = getStatusCfg(contact.status || "unread");
                  return (
                    <motion.div key={contact.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
                      <Card className="rounded-2xl hover:shadow-md transition-all">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                                <EnvelopeSimple size={18} weight="duotone" className="text-violet-400" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{contact.name}</CardTitle>
                                <CardDescription className="text-xs">{contact.email}</CardDescription>
                              </div>
                            </div>
                            <Badge className={`${sc.cls} rounded-full text-[11px] px-2.5 py-0.5 font-semibold shrink-0`}>
                              {sc.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground mb-3">{contact.message}</p>
                          <p className="text-[11px] text-muted-foreground/60">Received {formatDate(contact.createdAt)}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              ) : null}
            </TabsContent>
          )}

          {/* ── User-only tabs ── */}
          {!isAdmin && (
            <>
              <TabsContent value="chat" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                <ChatPanel />
              </TabsContent>
              <TabsContent value="profile" className="mt-4">
                <UserProfileForm />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
