import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarBlank as CalendarIcon,
  Image as ImageIcon,
  ChatDots as MessageSquareIcon,
  Users as UsersIcon,
  CheckCircle as CheckCircleIcon,
  Clock as ClockIcon,
  XCircle as XCircleIcon,
  Folder as FolderIcon,
  Star,
  ShieldCheck as Shield,
  Camera,
  CurrencyDollar as DollarSignIcon,
  Gear as Settings,
  Tag,
  ChatDots as MessageSquare,
  User,
  BookOpen,
  Money as BanknoteIcon
} from "@phosphor-icons/react";
import { AdminBookings } from "@/components/admin-bookings";
import { AdminGalleries } from "@/components/admin-galleries";
import { AdminContacts } from "@/components/admin-contacts";
import { AdminCatalogues } from "@/components/admin-catalogues";
import { AdminReviews } from "@/components/admin-reviews";
import { AdminUsers } from "@/components/admin-users";
import { AdminPhotographers } from "@/components/admin-photographers";
import { AdminPricing } from "@/components/admin-pricing";
import { AdminSite } from "@/components/admin-site";
import { AdminCoupons } from "@/components/admin-coupons";
import { AdminBlog } from "@/components/admin-blog";
import { AdminPayouts } from "@/components/admin-payouts";
import { ChatPanel } from "@/components/chat-panel";
import { UserProfileForm } from "@/components/user-profile-form";

export function AdminDashboard() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const [location] = useLocation();
  const [tabValue, setTabValue] = useState(
    () => new URLSearchParams(window.location.search).get("tab") || "bookings"
  );

  useEffect(() => {
    const nextTab = new URLSearchParams(window.location.search).get("tab") || "bookings";
    setTabValue(nextTab);
  }, [location]);

  // Fetch dashboard statistics
  const { data: bookings } = useQuery<any[]>({
    queryKey: ["/api/admin/bookings"],
    refetchInterval: 10000,
  });

  const { data: galleries } = useQuery<any[]>({
    queryKey: ["/api/admin/galleries"],
  });

  const { data: contacts } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts"],
    refetchInterval: 10000,
  });

  const { data: catalogues } = useQuery<any[]>({
    queryKey: ["/api/admin/catalogues"],
  });

  const { data: reviews } = useQuery<any[]>({
    queryKey: ["/api/admin/reviews"],
  });

  const { data: pendingPhotographers } = useQuery<any[]>({
    queryKey: ["/api/admin/photographers/pending"],
    refetchInterval: 10000,
  });

  const { data: inboundEmails } = useQuery<any[]>({
    queryKey: ["/api/admin/inbound-emails"],
    refetchInterval: 10000,
  });

  const { data: unreadChatData } = useQuery<{ count: number }>({
    queryKey: ["/api/conversations/unread-count"],
    refetchInterval: 4000,
  });
  const unreadChatCount = unreadChatData?.count ?? 0;



  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeGalleries = Array.isArray(galleries) ? galleries : [];
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeCatalogues = Array.isArray(catalogues) ? catalogues : [];
  const safeReviews = Array.isArray(reviews) ? reviews : [];

  const pendingBookings = safeBookings.filter((b: any) => b.status === 'pending').length;
  const confirmedBookings = safeBookings.filter((b: any) => b.status === 'confirmed').length;
  const pendingGalleries = safeGalleries.filter((g: any) => g.status === 'pending').length;
  const safeInbound = Array.isArray(inboundEmails) ? inboundEmails : [];
  const unreadContacts = safeContacts.filter((c: any) => c.status === 'unread').length
    + safeInbound.filter((e: any) => !e.isRead && e.status !== 'responded').length;
  const publishedCatalogues = safeCatalogues.filter((c: any) => c.isPublished).length;
  const draftCatalogues = safeCatalogues.filter((c: any) => !c.isPublished).length;
  const pendingReviews = safeReviews.filter((r: any) => !r.isApproved).length;
  const approvedReviews = safeReviews.filter((r: any) => r.isApproved).length;
  const pendingPhotographerCount = pendingPhotographers?.length || 0;

  const isChat = tabValue === "chat";

  return (
    <div className={isChat
      ? "h-screen overflow-hidden flex flex-col bg-background"
      : "min-h-screen bg-background pb-16"
    }>
      <div className={isChat
        ? "max-w-7xl w-full mx-auto flex flex-col flex-1 min-h-0 px-4 pt-24"
        : "max-w-7xl mx-auto px-4 pt-24"
      }>
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={isChat ? "mb-4 flex-shrink-0" : "mb-10"}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber-500 mb-1.5 flex items-center gap-1.5">
                <Settings size={11} /> Admin Console
              </p>
              <h1
                className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground"
                style={{ fontFamily: 'var(--font-display, var(--font-serif))' }}
              >
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Welcome back, {user?.firstName || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline" size="sm" className="rounded-full h-9 px-4 gap-1.5 text-xs" data-testid="button-home">
                  ← Website
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Stat cards ── */}
        {!isChat && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8"
          >
            {[
              { icon: <ClockIcon size={20} weight="duotone" className="text-amber-500" />, value: pendingBookings, label: "Pending", sub: "bookings", tab: "bookings", accent: "text-amber-500", testId: "stat-pending-bookings" },
              { icon: <CheckCircleIcon size={20} weight="duotone" className="text-emerald-400" />, value: confirmedBookings, label: "Confirmed", sub: "ready for shoots", tab: "bookings", accent: "text-emerald-400", testId: "stat-confirmed-bookings" },
              { icon: <ImageIcon size={20} weight="duotone" className="text-blue-400" />, value: pendingGalleries, label: "Galleries", sub: "need uploads", tab: "galleries", accent: "text-blue-400", testId: "stat-pending-galleries" },
              { icon: <MessageSquareIcon size={20} weight="duotone" className="text-violet-400" />, value: unreadContacts, label: "Messages", sub: "unread", tab: "contacts", accent: "text-violet-400", testId: "stat-unread-messages" },
              { icon: <FolderIcon size={20} weight="duotone" className="text-amber-400" />, value: publishedCatalogues, label: "Catalogues", sub: "live", tab: "catalogues", accent: "text-amber-400", testId: "stat-published-catalogues" },
              { icon: <Star size={20} weight="duotone" className="text-rose-400" />, value: pendingReviews, label: "Reviews", sub: "need approval", tab: "reviews", accent: "text-rose-400", testId: "stat-pending-reviews" },
            ].map((stat) => (
              <Card
                key={stat.testId}
                className="cursor-pointer rounded-2xl p-4 hover:border-amber-500/30 hover:shadow-md transition-all duration-200 group"
                onClick={() => setTabValue(stat.tab)}
                data-testid={stat.testId}
              >
                <div className="flex items-start justify-between mb-2">
                  {stat.icon}
                  <span className="text-[9px] text-muted-foreground/40 group-hover:text-amber-500 transition-colors font-medium uppercase tracking-wide">View →</span>
                </div>
                <div className={`text-2xl font-extrabold tracking-tight ${stat.accent}`}>{stat.value}</div>
                <div className="text-[11px] font-semibold text-foreground mt-0.5">{stat.label}</div>
                <div className="text-[10px] text-muted-foreground">{stat.sub}</div>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={tabValue} onValueChange={setTabValue} className={isChat ? "flex flex-col flex-1 min-h-0" : "space-y-6"}>
          <div className={`overflow-x-auto pb-1 -mx-1 px-1${isChat ? " flex-shrink-0" : ""}`}>
            <TabsList className="inline-flex w-max min-w-full h-auto flex-wrap sm:flex-nowrap gap-1 p-1">
              <TabsTrigger value="bookings" data-testid="tab-bookings" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <CalendarIcon size={16} className="shrink-0" />
                <span>Bookings</span>
                {pendingBookings > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{pendingBookings}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="galleries" data-testid="tab-galleries" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <ImageIcon size={16} className="shrink-0" />
                <span>Galleries</span>
                {pendingGalleries > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{pendingGalleries}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="contacts" data-testid="tab-contacts" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <MessageSquareIcon size={16} className="shrink-0" />
                <span>Messages</span>
                {unreadContacts > 0 && <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0">{unreadContacts}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="catalogues" data-testid="tab-catalogues" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <FolderIcon size={16} className="shrink-0" />
                <span>Catalogues</span>
                {draftCatalogues > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{draftCatalogues}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="reviews" data-testid="tab-reviews" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <Star size={16} className="shrink-0" />
                <span>Reviews</span>
                {pendingReviews > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{pendingReviews}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <Shield size={16} className="shrink-0" />
                <span>Users</span>
              </TabsTrigger>
              <TabsTrigger value="photographers" data-testid="tab-photographers" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <Camera size={16} className="shrink-0" />
                <span>Photographers</span>
                {pendingPhotographerCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{pendingPhotographerCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="pricing" data-testid="tab-pricing" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <DollarSignIcon size={16} className="shrink-0" />
                <span>Pricing</span>
              </TabsTrigger>
              <TabsTrigger value="coupons" data-testid="tab-coupons" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <Tag size={16} className="shrink-0" />
                <span>Coupons</span>
              </TabsTrigger>
              <TabsTrigger value="site" data-testid="tab-site" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <Settings size={16} className="shrink-0" />
                <span>Site</span>
              </TabsTrigger>
              <TabsTrigger value="chat" data-testid="tab-chat" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <MessageSquare size={16} className="shrink-0" />
                <span>Chat</span>
                {unreadChatCount > 0 && <Badge className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0">{unreadChatCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="blog" data-testid="tab-blog" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <BookOpen size={16} className="shrink-0" />
                <span>Blog</span>
              </TabsTrigger>
              <TabsTrigger value="payouts" data-testid="tab-payouts" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <BanknoteIcon size={16} className="shrink-0" />
                <span>Payouts</span>
              </TabsTrigger>
              <TabsTrigger value="profile" data-testid="tab-profile" className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs sm:text-sm">
                <User size={16} className="shrink-0" />
                <span>Profile</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="bookings">
            <AdminBookings />
          </TabsContent>

          <TabsContent value="galleries">
            <AdminGalleries />
          </TabsContent>

          <TabsContent value="contacts">
            <AdminContacts />
          </TabsContent>

          <TabsContent value="catalogues">
            <AdminCatalogues />
          </TabsContent>

          <TabsContent value="reviews">
            <AdminReviews />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>

          <TabsContent value="photographers">
            <AdminPhotographers />
          </TabsContent>

          <TabsContent value="pricing">
            <AdminPricing />
          </TabsContent>
          <TabsContent value="coupons">
            <AdminCoupons />
          </TabsContent>
          <TabsContent value="site">
            <AdminSite />
          </TabsContent>
          <TabsContent value="chat" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
            <ChatPanel isAdmin />
          </TabsContent>
          <TabsContent value="blog">
            <AdminBlog />
          </TabsContent>
          <TabsContent value="payouts">
            <AdminPayouts />
          </TabsContent>
          <TabsContent value="profile">
            <UserProfileForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}