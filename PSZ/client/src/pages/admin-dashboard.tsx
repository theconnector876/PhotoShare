import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarIcon, 
  ImageIcon, 
  MessageSquareIcon, 
  UsersIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  FolderIcon,
  Star,
  Shield
} from "lucide-react";
import { AdminBookings } from "@/components/admin-bookings";
import { AdminGalleries } from "@/components/admin-galleries";
import { AdminContacts } from "@/components/admin-contacts";
import { AdminCatalogues } from "@/components/admin-catalogues";
import { AdminReviews } from "@/components/admin-reviews";
import { AdminUsers } from "@/components/admin-users";

export function AdminDashboard() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  // Fetch dashboard statistics
  const { data: bookings } = useQuery<any[]>({
    queryKey: ["/api/admin/bookings"],

  });

  const { data: galleries } = useQuery<any[]>({
    queryKey: ["/api/admin/galleries"],

  });

  const { data: contacts } = useQuery<any[]>({
    queryKey: ["/api/admin/contacts"],

  });

  const { data: catalogues } = useQuery<any[]>({
    queryKey: ["/api/admin/catalogues"],

  });

  const { data: reviews } = useQuery<any[]>({
    queryKey: ["/api/admin/reviews"],

  });



  const pendingBookings = bookings?.filter((b: any) => b.status === 'pending').length || 0;
  const confirmedBookings = bookings?.filter((b: any) => b.status === 'confirmed').length || 0;
  const pendingGalleries = galleries?.filter((g: any) => g.status === 'pending').length || 0;
  const unreadContacts = contacts?.filter((c: any) => c.status === 'unread').length || 0;
  const publishedCatalogues = catalogues?.filter((c: any) => c.isPublished).length || 0;
  const draftCatalogues = catalogues?.filter((c: any) => !c.isPublished).length || 0;
  const pendingReviews = reviews?.filter((r: any) => !r.isApproved).length || 0;
  const approvedReviews = reviews?.filter((r: any) => r.isApproved).length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-green-800">Admin Dashboard</h1>
              <p className="text-green-600 mt-2">Welcome back, {user?.firstName || user?.email}</p>
            </div>
            <div className="flex gap-4">
              <Link href="/">
                <Button 
                  variant="outline" 
                  data-testid="button-home"
                >
                  Back to Website
                </Button>
              </Link>
              <Link href="/auth">
                <Button 
                  variant="destructive" 
                  data-testid="button-logout"
                >
                  Logout
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Bookings</CardTitle>
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="stat-pending-bookings">
                {pendingBookings}
              </div>
              <p className="text-xs text-muted-foreground">
                Require confirmation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confirmed Bookings</CardTitle>
              <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="stat-confirmed-bookings">
                {confirmedBookings}
              </div>
              <p className="text-xs text-muted-foreground">
                Ready for shoots
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Galleries</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="stat-pending-galleries">
                {pendingGalleries}
              </div>
              <p className="text-xs text-muted-foreground">
                Need image uploads
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
              <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="stat-unread-messages">
                {unreadContacts}
              </div>
              <p className="text-xs text-muted-foreground">
                New inquiries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published Catalogues</CardTitle>
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="stat-published-catalogues">
                {publishedCatalogues}
              </div>
              <p className="text-xs text-muted-foreground">
                Live on portfolio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="stat-pending-reviews">
                {pendingReviews}
              </div>
              <p className="text-xs text-muted-foreground">
                Need approval
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="bookings" data-testid="tab-bookings">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Bookings
              {pendingBookings > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingBookings}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="galleries" data-testid="tab-galleries">
              <ImageIcon className="w-4 h-4 mr-2" />
              Galleries
              {pendingGalleries > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingGalleries}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">
              <MessageSquareIcon className="w-4 h-4 mr-2" />
              Messages
              {unreadContacts > 0 && (
                <Badge variant="outline" className="ml-2">
                  {unreadContacts}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="catalogues" data-testid="tab-catalogues">
              <FolderIcon className="w-4 h-4 mr-2" />
              Catalogues
              {draftCatalogues > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {draftCatalogues}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">
              <Star className="w-4 h-4 mr-2" />
              Reviews
              {pendingReviews > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingReviews}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Shield className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

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
        </Tabs>
      </div>
    </div>
  );
}