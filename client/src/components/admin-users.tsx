import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Shield, User, Crown, Mail, Calendar, Ban, Unlock, Trash2, KeyRound, Pencil, Eye, Phone, MapPin, Camera } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isUnauthorizedError } from "@/lib/authUtils";

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  isBlocked: boolean;
  role?: string | null;
  photographerStatus?: string | null;
  phone?: string | null;
  createdAt: string;
}

interface BookingSummary {
  id: string;
  clientName: string;
  serviceType: string;
  packageType: string;
  shootDate: string;
  totalPrice: number;
  currency: string;
  status: string;
  depositPaid: boolean;
  balancePaid: boolean;
  createdAt: string;
}

interface PhotographerProfileData {
  displayName?: string | null;
  bio?: string | null;
  location?: string | null;
  specialties?: string[];
  phone?: string | null;
}

interface UserProfileData {
  user: UserData;
  photographerProfile: PhotographerProfileData | null;
  bookings: BookingSummary[];
}

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const editUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email address").optional(),
  password: z.string().min(6).optional().or(z.literal("")),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

export function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userSort, setUserSort] = useState("newest");

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { email: "", password: "", firstName: "", lastName: "" },
  });

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { email: "", firstName: "", lastName: "", password: "" },
  });

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const { data: userProfile, isLoading: profileLoading } = useQuery<UserProfileData>({
    queryKey: ["/api/admin/users", viewingUserId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/users/${viewingUserId}`);
      return res.json();
    },
    enabled: !!viewingUserId,
  });

  const makeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/admin/make-admin/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Promoted", description: "User has been promoted to admin successfully." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Error", description: "Failed to promote user to admin.", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserFormData) => {
      await apiRequest("/api/register", "POST", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Created", description: "New user has been created successfully." });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create user.", variant: "destructive" });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditUserFormData }) => {
      const payload: Record<string, string> = {};
      if (data.firstName) payload.firstName = data.firstName;
      if (data.lastName) payload.lastName = data.lastName;
      if (data.email) payload.email = data.email;
      if (data.password) payload.password = data.password;
      await apiRequest("PUT", `/api/admin/users/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Updated" });
      setEditingUser(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user.", variant: "destructive" });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}/block`, { blocked });
    },
    onSuccess: (_, { blocked }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: blocked ? "User Blocked" : "User Unblocked" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to block/unblock user.", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/admin/users/${userId}/reset-password`, {});
    },
    onSuccess: () => {
      toast({ title: "Reset Email Sent", description: "Password reset email sent to user." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send reset email.", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User Deleted" });
      setDeletingUserId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete user.", variant: "destructive" });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const filteredUsers = (users ?? [])
    .filter(u => {
      if (userSearch) {
        const s = userSearch.toLowerCase();
        if (
          !(u.firstName ?? "").toLowerCase().includes(s) &&
          !(u.lastName ?? "").toLowerCase().includes(s) &&
          !u.email.toLowerCase().includes(s)
        ) return false;
      }
      if (roleFilter === "admin") return u.isAdmin;
      if (roleFilter === "photographer") return u.role === "photographer";
      if (roleFilter === "client") return !u.isAdmin && u.role !== "photographer";
      if (roleFilter === "blocked") return u.isBlocked;
      return true;
    })
    .sort((a, b) => {
      if (userSort === "name-asc") return `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`);
      if (userSort === "name-desc") return `${b.firstName}${b.lastName}`.localeCompare(`${a.firstName}${a.lastName}`);
      if (userSort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // newest
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Management
              </CardTitle>
              <CardDescription>Manage user accounts and admin privileges.</CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-user">
                  <User className="w-4 h-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>Create a new user account.</DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit((d) => createUserMutation.mutate(d))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={createForm.control} name="firstName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl><Input placeholder="John" {...field} data-testid="input-firstname" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={createForm.control} name="lastName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl><Input placeholder="Doe" {...field} data-testid="input-lastname" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={createForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} data-testid="input-email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={createForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl><Input type="password" placeholder="Enter password" {...field} data-testid="input-password" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
                      <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit">
                        {createUserMutation.isPending ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search / Filter / Sort */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Input
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="h-8 text-sm w-48"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="client">Clients</SelectItem>
                <SelectItem value="photographer">Photographers</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userSort} onValueChange={setUserSort}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name-asc">Name A–Z</SelectItem>
                <SelectItem value="name-desc">Name Z–A</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground self-center ml-1">
              {filteredUsers.length} of {users?.length ?? 0}
            </span>
          </div>
          <div className="space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-xl font-semibold mb-2">No users found</h3>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className={user.isBlocked ? "opacity-60 border-red-200" : ""}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold text-lg">{user.firstName} {user.lastName}</h4>
                            {user.isAdmin && (
                              <Badge className="bg-purple-500 text-white">
                                <Crown className="w-3 h-3 mr-1" />Admin
                              </Badge>
                            )}
                            {user.isBlocked && (
                              <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" />Blocked</Badge>
                            )}
                            {user.role && <Badge variant="secondary">{user.role}</Badge>}
                            {user.photographerStatus && <Badge variant="outline">{user.photographerStatus}</Badge>}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                            <div className="flex items-center gap-1"><Mail className="w-4 h-4" />{user.email}</div>
                            <div className="flex items-center gap-1"><Calendar className="w-4 h-4" />Joined {formatDate(user.createdAt)}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {!user.isAdmin && (
                            <Button variant="outline" size="sm" onClick={() => makeAdminMutation.mutate(user.id)} disabled={makeAdminMutation.isPending} data-testid={`button-make-admin-${user.id}`}>
                              <Shield className="w-4 h-4 mr-1" />Make Admin
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingUserId(user.id)}
                          >
                            <Eye className="w-4 h-4 mr-1" />View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingUser(user);
                              editForm.reset({ firstName: user.firstName || "", lastName: user.lastName || "", email: user.email || "", password: "" });
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-1" />Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => blockUserMutation.mutate({ id: user.id, blocked: !user.isBlocked })}
                            disabled={blockUserMutation.isPending}
                          >
                            {user.isBlocked ? <><Unlock className="w-4 h-4 mr-1" />Unblock</> : <><Ban className="w-4 h-4 mr-1" />Block</>}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => resetPasswordMutation.mutate(user.id)} disabled={resetPasswordMutation.isPending}>
                            <KeyRound className="w-4 h-4 mr-1" />Reset PW
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeletingUserId(user.id)}>
                            <Trash2 className="w-4 h-4 mr-1" />Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) setEditingUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information. Leave password blank to keep unchanged.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((d) => editingUser && editUserMutation.mutate({ id: editingUser.id, data: d }))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>New Password (optional)</FormLabel><FormControl><Input type="password" placeholder="Leave blank to keep current" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit" disabled={editUserMutation.isPending}>{editUserMutation.isPending ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingUserId} onOpenChange={(open) => { if (!open) setDeletingUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>Are you sure you want to delete this user? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeletingUserId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingUserId && deleteUserMutation.mutate(deletingUserId)} disabled={deleteUserMutation.isPending}>
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Profile Dialog */}
      <Dialog open={!!viewingUserId} onOpenChange={(open) => { if (!open) setViewingUserId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              User Profile
            </DialogTitle>
          </DialogHeader>
          {profileLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          ) : userProfile ? (
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-5">
                {/* Basic Info */}
                <div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <h3 className="text-xl font-semibold">
                      {userProfile.user.firstName} {userProfile.user.lastName}
                    </h3>
                    {userProfile.user.isAdmin && (
                      <Badge className="bg-purple-500 text-white"><Crown className="w-3 h-3 mr-1" />Admin</Badge>
                    )}
                    {userProfile.user.isBlocked && (
                      <Badge variant="destructive"><Ban className="w-3 h-3 mr-1" />Blocked</Badge>
                    )}
                    {userProfile.user.role && <Badge variant="secondary">{userProfile.user.role}</Badge>}
                    {userProfile.user.photographerStatus && (
                      <Badge variant="outline">{userProfile.user.photographerStatus}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Mail className="w-4 h-4" />{userProfile.user.email}</div>
                    {userProfile.user.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4" />{userProfile.user.phone}</div>}
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" />Joined {formatDate(userProfile.user.createdAt)}</div>
                  </div>
                </div>

                {/* Photographer Profile */}
                {userProfile.photographerProfile && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Camera className="w-4 h-4" />Photographer Profile</h4>
                      <div className="space-y-2 text-sm">
                        {userProfile.photographerProfile.displayName && (
                          <p><span className="text-muted-foreground">Display name:</span> {userProfile.photographerProfile.displayName}</p>
                        )}
                        {userProfile.photographerProfile.location && (
                          <p className="flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" />{userProfile.photographerProfile.location}</p>
                        )}
                        {userProfile.photographerProfile.phone && (
                          <p className="flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" />{userProfile.photographerProfile.phone}</p>
                        )}
                        {userProfile.photographerProfile.bio && (
                          <p className="text-muted-foreground leading-relaxed">{userProfile.photographerProfile.bio}</p>
                        )}
                        {(userProfile.photographerProfile.specialties ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {userProfile.photographerProfile.specialties!.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Bookings */}
                <Separator />
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Bookings ({userProfile.bookings.length})
                  </h4>
                  {userProfile.bookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No bookings yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {userProfile.bookings.slice().reverse().map(b => (
                        <div key={b.id} className="border rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="font-medium">{b.serviceType} — {b.packageType}</div>
                            <Badge variant={b.status === 'completed' ? 'default' : b.status === 'confirmed' ? 'secondary' : 'outline'} className="text-xs">
                              {b.status}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                            <span>{b.shootDate}</span>
                            <span>{b.currency} {(b.totalPrice / 100).toLocaleString()}</span>
                            <span className={b.depositPaid ? "text-emerald-600 dark:text-emerald-400" : "text-orange-500"}>
                              Deposit: {b.depositPaid ? "paid" : "unpaid"}
                            </span>
                            <span className={b.balancePaid ? "text-emerald-600 dark:text-emerald-400" : "text-orange-500"}>
                              Balance: {b.balancePaid ? "paid" : "unpaid"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
