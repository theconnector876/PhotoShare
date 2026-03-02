import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Download, Eye, Camera, Clock, MapPin, Phone, Mail, LogOut, ArrowRight, MessageSquare, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { ChatPanel } from "@/components/chat-panel";
import { UserProfileForm } from "@/components/user-profile-form";

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
  lemonSqueezyDepositCheckoutId: string | null;
  lemonSqueezyBalanceCheckoutId: string | null;
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

export default function Dashboard() {
  const { user, isLoading: authLoading, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

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

  // Admin-specific data queries
  const isAdmin = user?.isAdmin || false;
  const { data: adminContacts } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts"],
    enabled: !!user && isAdmin,
    retry: false,
  });

  // Redirect only if not authenticated (no admin redirect - keep admins on dashboard with extra tabs)
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation("/auth");
    }
    if (!authLoading && user?.role === "photographer") {
      setLocation("/photographer");
    }
  }, [authLoading, user, setLocation]);
  
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  if (!user) {
    return null; // Will redirect via useEffect
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800", 
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'wedding':
        return '💍';
      case 'event':
        return '🎉';
      case 'photoshoot':
        return '📸';
      default:
        return '📷';
    }
  };

  if (authLoading || bookingsLoading) {
    return (
      <div className="pt-16 pb-20 bg-background relative z-10">
        <div className="max-w-4xl mx-auto px-4 mt-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 pb-20 bg-background relative z-10">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 mt-8">
          <div>
            <h1 className="text-4xl font-bold font-serif gradient-text">
              {isAdmin ? "Admin Dashboard" : `Welcome back, ${user?.firstName}!`}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isAdmin 
                ? "Manage all bookings, galleries, and customer inquiries"
                : "Manage your photography bookings and access your galleries"
              }
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="mr-2" size={16} />
            {logoutMutation.isPending ? "Logging out..." : "Sign Out"}
          </Button>
        </div>

        {/* Admin Statistics Dashboard */}
        {isAdmin && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Admin Overview</h2>
              <Button onClick={() => setLocation("/admin")} className="gap-2">
                Open Admin Dashboard
                <ArrowRight size={16} />
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/admin?tab=bookings")}>
                <div className="text-2xl font-bold text-primary">{userBookings?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Total Bookings</div>
                <div className="text-xs text-primary mt-1 flex items-center gap-1">Manage <ArrowRight size={10} /></div>
              </Card>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/admin?tab=galleries")}>
                <div className="text-2xl font-bold text-primary">{userGalleries?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Total Galleries</div>
                <div className="text-xs text-primary mt-1 flex items-center gap-1">Manage <ArrowRight size={10} /></div>
              </Card>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/admin?tab=contacts")}>
                <div className="text-2xl font-bold text-primary">{Array.isArray(adminContacts) ? adminContacts.length : 0}</div>
                <div className="text-sm text-muted-foreground">Contact Messages</div>
                <div className="text-xs text-primary mt-1 flex items-center gap-1">View <ArrowRight size={10} /></div>
              </Card>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/admin?tab=catalogues")}>
                <div className="text-2xl font-bold text-primary">—</div>
                <div className="text-sm text-muted-foreground">Catalogues & Site</div>
                <div className="text-xs text-primary mt-1 flex items-center gap-1">Edit <ArrowRight size={10} /></div>
              </Card>
            </div>
          </div>
        )}

        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-4'}`}>
            <TabsTrigger value="bookings" data-testid="tab-bookings">
              {isAdmin ? "All Bookings" : "My Bookings"}
            </TabsTrigger>
            <TabsTrigger value="galleries" data-testid="tab-galleries">
              {isAdmin ? "All Galleries" : "My Galleries"}
            </TabsTrigger>
            {isAdmin ? (
              <TabsTrigger value="contacts" data-testid="tab-contacts">
                Contact Messages
              </TabsTrigger>
            ) : (
              <>
                <TabsTrigger value="chat" data-testid="tab-chat" className="relative">
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                  Chat
                  {unreadCount > 0 && (
                    <Badge className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0 h-4">{unreadCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="profile" data-testid="tab-profile">
                  <User className="w-4 h-4 mr-1.5" />
                  Profile
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="bookings" className="space-y-6">
            <div className="grid gap-6">
              {!userBookings || userBookings.length === 0 ? (
                <Card className="p-12 text-center">
                  <Calendar className="mx-auto text-muted-foreground mb-4" size={48} />
                  <h3 className="text-xl font-semibold mb-2">No bookings yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Ready to capture your special moments? Book a session with us!
                  </p>
                  <Button 
                    onClick={() => setLocation("/booking")}
                    className="bg-gradient-to-r from-primary to-secondary text-white"
                    data-testid="button-book-session"
                  >
                    Book a Session
                  </Button>
                </Card>
              ) : (
                userBookings.map((booking) => (
                  <Card key={booking.id} className="hover-3d">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center">
                            <span className="mr-2 text-2xl">{getServiceIcon(booking.serviceType)}</span>
                            {booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1)} - {booking.packageType}
                          </CardTitle>
                          <CardDescription>
                            Booked on {formatDate(booking.createdAt)}
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(booking.status)} data-testid={`status-${booking.id}`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <Calendar className="mr-2" size={16} />
                            <span>{formatDate(booking.shootDate)} at {booking.shootTime}</span>
                          </div>
                          <div className="flex items-center">
                            <MapPin className="mr-2" size={16} />
                            <span>{booking.location}, {booking.parish}</span>
                          </div>
                          {booking.numberOfPeople > 1 && (
                            <div className="flex items-center">
                              <Camera className="mr-2" size={16} />
                              <span>{booking.numberOfPeople} people</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <Phone className="mr-2" size={16} />
                            <span>{booking.contactNumber}</span>
                          </div>
                          <div className="flex items-center">
                            <Mail className="mr-2" size={16} />
                            <span>{booking.email}</span>
                          </div>
                          <div className="text-lg font-semibold text-primary">
                            Total: ${booking.totalPrice}
                          </div>
                          <div className="text-sm mt-1">
                            <span className={booking.depositPaid ? "text-green-600" : "text-orange-500"}>
                              Deposit ${booking.depositAmount}: {booking.depositPaid ? "✓ Paid" : "Pending"}
                            </span>
                          </div>
                          <div className="text-sm">
                            <span className={booking.balancePaid ? "text-green-600" : "text-muted-foreground"}>
                              Balance ${booking.balanceDue}: {booking.balancePaid ? "✓ Paid" : booking.depositPaid ? "Pending" : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="galleries" className="space-y-6">
            <div className="grid gap-6">
              {!userGalleries || userGalleries.length === 0 ? (
                <Card className="p-12 text-center">
                  <Camera className="mx-auto text-muted-foreground mb-4" size={48} />
                  <h3 className="text-xl font-semibold mb-2">No galleries available</h3>
                  <p className="text-muted-foreground">
                    Your galleries will appear here after your photoshoot is completed.
                  </p>
                </Card>
              ) : (
                userGalleries.map((gallery) => (
                  <Card key={gallery.id} className="hover-3d">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>Gallery #{gallery.id.slice(-8)}</CardTitle>
                          <CardDescription>
                            Created on {formatDate(gallery.createdAt)}
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(gallery.status)}>
                          {gallery.status.charAt(0).toUpperCase() + gallery.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {gallery.galleryImages?.length || 0}
                          </div>
                          <div className="text-muted-foreground">Gallery Images</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-jamaica-gold">
                            {gallery.selectedImages?.length || 0}
                          </div>
                          <div className="text-muted-foreground">Selected Images</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {gallery.finalImages?.length || 0}
                          </div>
                          <div className="text-muted-foreground">Final Images</div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4 flex-wrap">
                        {gallery.galleryImages?.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation(`/gallery/${encodeURIComponent(gallery.clientEmail)}/${gallery.accessCode}`)}
                            data-testid={`button-view-gallery-${gallery.id}`}
                          >
                            <Eye className="mr-2" size={16} />
                            Open Gallery
                          </Button>
                        )}
                        {gallery.finalImages?.length > 0 && (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-primary to-secondary text-white"
                            onClick={() => setLocation(`/gallery/${encodeURIComponent(gallery.clientEmail)}/${gallery.accessCode}`)}
                            data-testid={`button-download-final-${gallery.id}`}
                          >
                            <Download className="mr-2" size={16} />
                            View Finals
                          </Button>
                        )}
                        {gallery.galleryImages?.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">Awaiting photo upload</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Admin-only tabs */}
          {isAdmin && (
            <>
              <TabsContent value="contacts" className="space-y-6">
                <div className="grid gap-6">
                  {!adminContacts || (Array.isArray(adminContacts) && adminContacts.length === 0) ? (
                    <Card className="p-12 text-center">
                      <Mail className="mx-auto text-muted-foreground mb-4" size={48} />
                      <h3 className="text-xl font-semibold mb-2">No contact messages</h3>
                      <p className="text-muted-foreground">
                        No client inquiries have been received yet.
                      </p>
                    </Card>
                  ) : Array.isArray(adminContacts) ? (
                    adminContacts.map((contact: any) => (
                      <Card key={contact.id} className="hover-3d">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle>{contact.name}</CardTitle>
                              <CardDescription>{contact.email}</CardDescription>
                            </div>
                            <Badge className={getStatusColor(contact.status || "unread")}>
                              {(contact.status || "unread").charAt(0).toUpperCase() + (contact.status || "unread").slice(1)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">
                            {contact.message}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Received on {formatDate(contact.createdAt)}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card className="p-12 text-center">
                      <Mail className="mx-auto text-muted-foreground mb-4" size={48} />
                      <h3 className="text-xl font-semibold mb-2">Loading contacts...</h3>
                    </Card>
                  )}
                </div>
              </TabsContent>

            </>
          )}

          {!isAdmin && (
            <>
              <TabsContent value="chat">
                <ChatPanel />
              </TabsContent>
              <TabsContent value="profile">
                <UserProfileForm />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}