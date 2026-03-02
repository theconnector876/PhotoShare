import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UserProfileSheetProps {
  userId: string | null;
  onClose: () => void;
}

interface ProfileCardData {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
  profileImageUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  bookings: Array<{
    id: string;
    clientName: string;
    serviceType: string;
    shootDate: string;
    status: string;
  }>;
  galleries: Array<{
    id: string;
    bookingId: string;
    clientEmail: string;
    accessCode: string;
    status: string;
  }>;
  catalogues: Array<{
    id: string;
    title: string;
    coverImage: string;
    isPublished: boolean;
    serviceType: string;
  }>;
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "bg-green-100 text-green-800";
  if (status === "confirmed") return "bg-blue-100 text-blue-800";
  return "bg-yellow-100 text-yellow-800";
}

export function UserProfileSheet({ userId, onClose }: UserProfileSheetProps) {
  const { data: profile, isLoading } = useQuery<ProfileCardData>({
    queryKey: [`/api/users/${userId}/profile-card`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/users/${userId}/profile-card`);
      return res.json();
    },
    enabled: !!userId,
  });

  const fullName = profile
    ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || profile.email || "User"
    : "";
  const initials = fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Profile</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="mt-4 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14">
                <AvatarImage src={profile.profileImageUrl ?? undefined} />
                <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold truncate">{fullName}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                <Badge variant="outline" className="text-[10px] mt-0.5 capitalize">
                  {profile.isAdmin ? "Admin" : profile.role}
                </Badge>
              </div>
            </div>

            {/* Bookings */}
            {profile.bookings && profile.bookings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Bookings
                </p>
                <div className="space-y-2">
                  {profile.bookings.map((b) => {
                    const gallery = profile.galleries?.find((g) => g.bookingId === b.id);
                    return (
                      <div key={b.id} className="border rounded-lg p-2.5 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium capitalize truncate">{b.serviceType}</p>
                            <p className="text-[10px] text-muted-foreground">{b.shootDate}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] capitalize ${statusBadgeClass(b.status)}`}
                          >
                            {b.status}
                          </Badge>
                        </div>
                        {gallery && (
                          <a
                            href={`/gallery?email=${encodeURIComponent(gallery.clientEmail)}&code=${gallery.accessCode}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-[10px] text-primary hover:underline"
                          >
                            View Gallery →
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Catalogues */}
            {profile.catalogues && profile.catalogues.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Catalogues
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {profile.catalogues.map((c) => (
                    <div key={c.id} className="rounded-lg overflow-hidden border">
                      {c.coverImage ? (
                        <img src={c.coverImage} alt={c.title} className="w-full h-16 object-cover" />
                      ) : (
                        <div className="w-full h-16 bg-muted" />
                      )}
                      <div className="p-1.5">
                        <p className="text-[10px] font-medium truncate">{c.title}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {c.isPublished ? "Published" : "Draft"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.bookings?.length === 0 && profile.catalogues?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No work to display.</p>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
