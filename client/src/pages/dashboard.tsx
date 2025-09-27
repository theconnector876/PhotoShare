import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Download, Eye, Camera, Clock, MapPin, Phone, Mail, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

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
  status: string;
  createdAt: string;
}

interface UserGallery {
  id: string;
  bookingId: string;
  status: string;
  galleryImages: string[];
  selectedImages: string[];
  finalImages: string[];
  createdAt: string;
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
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
  }, [authLoading, user, setLocation]);
  
  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  if (!user) {
    return null; // Will redirect via useEffect
  }

  const handleLogout = () => {
    window.location.href = "/api/logout";
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
            data-testid="button-logout"
          >
            <LogOut className="mr-2" size={16} />
            Sign Out
          </Button>
        </div>

        {/* Admin Statistics Dashboard */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">System Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Total Bookings:</span>
                  <span className="font-medium">{userBookings?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Galleries:</span>
                  <span className="font-medium">{userGalleries?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Contact Messages:</span>
                  <span className="font-medium">{Array.isArray(adminContacts) ? adminContacts.length : 0}</span>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => setLocation("/booking")}
                >
                  <Camera className="mr-2" size={16} />
                  Create New Booking
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => setLocation("/gallery")}
                >
                  <Eye className="mr-2" size={16} />
                  Access Gallery
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Admin Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                  Admin Access Active
                </div>
                <div className="text-muted-foreground">
                  Managing all system operations
                </div>
              </div>
            </Card>
          </div>
        )}

        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <TabsTrigger value="bookings" data-testid="tab-bookings">
              {isAdmin ? "All Bookings" : "My Bookings"}
            </TabsTrigger>
            <TabsTrigger value="galleries" data-testid="tab-galleries">
              {isAdmin ? "All Galleries" : "My Galleries"}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="contacts" data-testid="tab-contacts">
                Contact Messages
              </TabsTrigger>
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

                      <div className="flex gap-2 mt-4">
                        {gallery.galleryImages?.length > 0 && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            data-testid={`button-view-gallery-${gallery.id}`}
                          >
                            <Eye className="mr-2" size={16} />
                            View Gallery
                          </Button>
                        )}
                        {gallery.finalImages?.length > 0 && (
                          <Button 
                            size="sm"
                            className="bg-gradient-to-r from-primary to-secondary text-white"
                            data-testid={`button-download-final-${gallery.id}`}
                          >
                            <Download className="mr-2" size={16} />
                            Download Final
                          </Button>
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
                            <Badge className={getStatusColor(contact.status)}>
                              {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
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
        </Tabs>
      </div>
    </div>
  );
}