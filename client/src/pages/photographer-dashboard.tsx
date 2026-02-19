import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { defaultPricingConfig, type PricingConfig } from "@shared/pricing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Camera, Calendar, Image, User, Clock, CheckCircle, Upload, Phone, Mail, MapPin, DollarSign, Users, GripVertical, X, Eye, Loader2, CheckCircle2, AlertCircle, Copy } from "lucide-react";

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
  status: string;
  totalPrice: number;
  depositAmount: number;
  balanceDue: number;
  depositPaid: boolean;
  balancePaid: boolean;
  addons: string[];
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

type GalleryImageType = 'gallery' | 'selected' | 'final';

interface SignedConfig {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
}

type UploadFileStatus = "queued" | "uploading" | "done" | "error" | "duplicate";
interface UploadFileItem {
  id: string;
  file: File;
  preview: string;
  status: UploadFileStatus;
  progress: number;
  error?: string;
}

function compressPhotoImage(file: File, maxDimension = 4096, quality = 0.88): Promise<File> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width: w, height: h } = img;
      if (w > maxDimension || h > maxDimension) {
        if (w >= h) { h = Math.round((h / w) * maxDimension); w = maxDimension; }
        else        { w = Math.round((w / h) * maxDimension); h = maxDimension; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg", quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

function uploadPhotoWithProgress(file: File, config: SignedConfig, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try { resolve((JSON.parse(xhr.responseText) as { secure_url: string }).secure_url); }
        catch { reject(new Error("Bad response")); }
      } else {
        try { const e = JSON.parse(xhr.responseText) as { error?: { message?: string } }; reject(new Error(e?.error?.message || `Error ${xhr.status}`)); }
        catch { reject(new Error(`Upload failed (${xhr.status})`)); }
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", config.apiKey);
    fd.append("timestamp", String(config.timestamp));
    fd.append("signature", config.signature);
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`);
    xhr.send(fd);
  });
}

type PhotographerProfile = {
  displayName?: string | null;
  bio?: string | null;
  location?: string | null;
  specialties?: string[] | null;
  portfolioLinks?: string[] | null;
  pricing?: string | null;
  availability?: string | null;
  phone?: string | null;
  socials?: Record<string, string> | null;
  verificationDocs?: string[] | null;
};

const parseCsv = (value?: string) =>
  value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];

const parseSocials = (value?: string) => {
  if (!value) return {};
  return value.split(",").reduce<Record<string, string>>((acc, entry) => {
    const [key, rawVal] = entry.split(":");
    if (key && rawVal) {
      acc[key.trim()] = rawVal.trim();
    }
    return acc;
  }, {});
};

export default function PhotographerDashboard() {
  const { user, isLoading, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    bio: "",
    location: "",
    specialties: "",
    portfolioLinks: "",
    pricing: "",
    availability: "",
    phone: "",
    socials: "",
    verificationDocs: "",
  });
  const [pricingRaw, setPricingRaw] = useState(JSON.stringify(defaultPricingConfig, null, 2));
  const [bookingStatusDraft, setBookingStatusDraft] = useState<Record<string, string>>({});
  const [uploadType, setUploadType] = useState<GalleryImageType>('gallery');

  // Gallery drag-and-drop state
  const [galDragSrc, setGalDragSrc] = useState<{ galleryId: string; type: GalleryImageType; index: number } | null>(null);
  const [galDragOver, setGalDragOver] = useState<{ galleryId: string; type: GalleryImageType; index: number } | null>(null);
  const [galPreview, setGalPreview] = useState<string | null>(null);

  // Upload panel state
  const [galUploadItems, setGalUploadItems] = useState<UploadFileItem[]>([]);
  const [showGalUploadPanel, setShowGalUploadPanel] = useState(false);

  const { data: profileData } = useQuery<{ profile?: PhotographerProfile; status?: string | null }>({
    queryKey: ["/api/photographer/profile"],
    enabled: !!user,
  });

  const { data: pricingData } = useQuery<{ config: PricingConfig }>({
    queryKey: ["/api/photographer/pricing"],
    enabled: !!user,
    retry: false,
  });

  const { data: userBookings } = useQuery<UserBooking[]>({
    queryKey: ["/api/photographer/bookings"],
    enabled: !!user,
    retry: false,
  });

  const { data: userGalleries } = useQuery<UserGallery[]>({
    queryKey: ["/api/photographer/galleries"],
    enabled: !!user,
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
    if (!isLoading && user?.role === "client") {
      setLocation("/dashboard");
    }
  }, [isLoading, user, setLocation]);

  useEffect(() => {
    if (profileData?.profile) {
      const profile = profileData.profile;
      setProfileForm({
        displayName: profile.displayName ?? "",
        bio: profile.bio ?? "",
        location: profile.location ?? "",
        specialties: (profile.specialties ?? []).join(", "),
        portfolioLinks: (profile.portfolioLinks ?? []).join(", "),
        pricing: profile.pricing ?? "",
        availability: profile.availability ?? "",
        phone: profile.phone ?? "",
        socials: profile.socials
          ? Object.entries(profile.socials).map(([key, val]) => `${key}:${val}`).join(", ")
          : "",
        verificationDocs: (profile.verificationDocs ?? []).join(", "),
      });
    }
  }, [profileData]);

  useEffect(() => {
    if (pricingData?.config) {
      setPricingRaw(JSON.stringify(pricingData.config, null, 2));
    }
  }, [pricingData]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        location: profileForm.location,
        specialties: parseCsv(profileForm.specialties),
        portfolioLinks: parseCsv(profileForm.portfolioLinks),
        pricing: profileForm.pricing,
        availability: profileForm.availability,
        phone: profileForm.phone,
        socials: parseSocials(profileForm.socials),
        verificationDocs: parseCsv(profileForm.verificationDocs),
      };
      const res = await apiRequest("PATCH", "/api/photographer/profile", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/profile"] });
      toast({ title: "Profile updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async (config: PricingConfig) => {
      const res = await apiRequest("PUT", "/api/photographer/pricing", { config });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/pricing"] });
      toast({ title: "Pricing updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Pricing update failed", description: error.message, variant: "destructive" });
    },
  });

  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      await apiRequest("PATCH", `/api/photographer/bookings/${bookingId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/bookings"] });
      toast({ title: "Booking status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const addImageMutation = useMutation({
    mutationFn: async ({ galleryId, imageURL, type }: { galleryId: string; imageURL: string; type: string }) => {
      await apiRequest("PUT", "/api/photographer/gallery-images", { galleryId, imageURL, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/galleries"] });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const updateGalleryImagesMutation = useMutation({
    mutationFn: async ({ galleryId, images, type }: { galleryId: string; images: string[]; type: GalleryImageType }) => {
      await apiRequest("PATCH", `/api/photographer/gallery/${galleryId}/images`, { images, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/galleries"] });
    },
    onError: () => {
      toast({ title: "Failed to update gallery", variant: "destructive" });
    },
  });

  // ── Gallery drag handlers ────────────────────────────────────────────────────

  const handleGalDragStart = useCallback((galleryId: string, type: GalleryImageType, index: number) => {
    setGalDragSrc({ galleryId, type, index });
  }, []);

  const handleGalDragOver = useCallback((e: React.DragEvent, galleryId: string, type: GalleryImageType, index: number) => {
    e.preventDefault();
    setGalDragOver({ galleryId, type, index });
  }, []);

  const handleGalDrop = useCallback((gallery: UserGallery, type: GalleryImageType, dropIndex: number) => {
    setGalDragSrc((src) => {
      if (!src || src.galleryId !== gallery.id || src.type !== type) return null;
      const images = type === "gallery" ? gallery.galleryImages || []
        : type === "selected" ? gallery.selectedImages || []
        : gallery.finalImages || [];
      const next = [...images];
      const [moved] = next.splice(src.index, 1);
      next.splice(dropIndex, 0, moved);
      updateGalleryImagesMutation.mutate({ galleryId: gallery.id, images: next, type });
      return null;
    });
    setGalDragOver(null);
  }, [updateGalleryImagesMutation]);

  const handleGalDragEnd = useCallback(() => { setGalDragSrc(null); setGalDragOver(null); }, []);

  const handleGalRemove = useCallback((gallery: UserGallery, type: GalleryImageType, url: string) => {
    const images = type === "gallery" ? gallery.galleryImages || []
      : type === "selected" ? gallery.selectedImages || []
      : gallery.finalImages || [];
    updateGalleryImagesMutation.mutate({ galleryId: gallery.id, images: images.filter((u) => u !== url), type });
  }, [updateGalleryImagesMutation]);

  // ── Gallery upload ────────────────────────────────────────────────────────────

  const updateGalItem = useCallback((id: string, patch: Partial<UploadFileItem>) => {
    setGalUploadItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleGalFilesSelected = useCallback(async (files: File[], gallery: UserGallery, type: GalleryImageType) => {
    const existingNames = new Set(
      [...(gallery.galleryImages || []), ...(gallery.selectedImages || []), ...(gallery.finalImages || [])]
        .map((url) => url.split("/").pop()?.split("?")[0]?.toLowerCase() ?? "")
    );
    const seenInBatch = new Set<string>();
    const items: UploadFileItem[] = files.map((file, i) => {
      const fp = `${file.name.toLowerCase()}::${file.size}`;
      const isDuplicate = existingNames.has(file.name.toLowerCase()) || seenInBatch.has(fp);
      seenInBatch.add(fp);
      return { id: `${Date.now()}-${i}`, file, preview: URL.createObjectURL(file), status: isDuplicate ? "duplicate" : "queued", progress: 0 };
    });
    setGalUploadItems(items);
    setShowGalUploadPanel(true);

    let config: SignedConfig;
    try {
      const res = await fetch("/api/photographer/upload-signature", { method: "POST", credentials: "include" });
      if (!res.ok) { const err = await res.json().catch(() => ({})) as { error?: string }; throw new Error(err.error || `Error ${res.status}`); }
      config = await res.json() as SignedConfig;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      items.forEach((item) => updateGalItem(item.id, { status: "error", error: msg }));
      return;
    }

    const queue = items.filter((i) => i.status !== "duplicate");
    async function processNext(): Promise<void> {
      const item = queue.shift();
      if (!item) return;
      updateGalItem(item.id, { status: "uploading", progress: 0 });
      try {
        const compressed = await compressPhotoImage(item.file);
        const url = await uploadPhotoWithProgress(compressed, config, (pct) => updateGalItem(item.id, { progress: pct }));
        updateGalItem(item.id, { status: "done", progress: 100 });
        await addImageMutation.mutateAsync({ galleryId: gallery.id, imageURL: url, type });
        queryClient.invalidateQueries({ queryKey: ["/api/photographer/galleries"] });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        updateGalItem(item.id, { status: "error", error: msg });
      }
      return processNext();
    }
    await Promise.all(Array.from({ length: 3 }, processNext));
  }, [addImageMutation, updateGalItem]);

  const closeGalUploadPanel = () => {
    galUploadItems.forEach((i) => URL.revokeObjectURL(i.preview));
    setGalUploadItems([]);
    setShowGalUploadPanel(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const bookingsCount = userBookings?.length ?? 0;
  const galleriesCount = userGalleries?.length ?? 0;
  const status = profileData?.status ?? user.photographerStatus;
  const approvalBadge =
    status === "approved" ? "bg-green-100 text-green-800" :
    status === "rejected" ? "bg-red-100 text-red-800" :
    "bg-yellow-100 text-yellow-800";
  const bookingLink =
    typeof window !== "undefined" ? `${window.location.origin}/book/${user.id}` : "";

  // Calculate revenue stats
  const totalRevenue = userBookings?.reduce((sum, b) => sum + b.totalPrice, 0) ?? 0;
  const collectedRevenue = userBookings?.reduce((sum, b) => {
    let collected = 0;
    if (b.depositPaid) collected += b.depositAmount;
    if (b.balancePaid) collected += b.balanceDue;
    return sum + collected;
  }, 0) ?? 0;
  const pendingRevenue = totalRevenue - collectedRevenue;
  const confirmedBookings = userBookings?.filter((b) => b.status === "confirmed").length ?? 0;
  const completedBookings = userBookings?.filter((b) => b.status === "completed").length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-yellow-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-green-800">Photographer Dashboard</h1>
            <p className="text-green-600 mt-2">
              Manage your profile, bookings, and galleries.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{bookingsCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {confirmedBookings} confirmed, {completedBookings} completed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All bookings value
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collected</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">${collectedRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Payments received
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${pendingRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting payment
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Galleries</CardTitle>
              <Image className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{galleriesCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approval Status</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge className={approvalBadge}>
                {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Share Your Booking Link</CardTitle>
            <CardDescription>
              Send this link to clients so they can book you directly at your rates.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3">
            <Input value={bookingLink} readOnly />
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(bookingLink);
                  toast({ title: "Link copied" });
                } catch (error) {
                  toast({ title: "Copy failed", description: "Select and copy the link manually.", variant: "destructive" });
                }
              }}
            >
              Copy Link
            </Button>
          </CardContent>
        </Card>

        {status !== "approved" && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 text-sm text-yellow-900">
              Your account is pending approval. You can complete your profile while we review your details.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="bookings">
              <Calendar className="w-4 h-4 mr-2" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="galleries">
              <Camera className="w-4 h-4 mr-2" />
              Galleries
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <Image className="w-4 h-4 mr-2" />
              Pricing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Photographer Profile</CardTitle>
                <CardDescription>Keep your profile up to date.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Display Name</Label>
                    <Input
                      value={profileForm.displayName}
                      onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Bio</Label>
                  <Input
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={profileForm.location}
                    onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Specialties (comma-separated)</Label>
                  <Input
                    value={profileForm.specialties}
                    onChange={(e) => setProfileForm({ ...profileForm, specialties: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Portfolio Links (comma-separated)</Label>
                  <Input
                    value={profileForm.portfolioLinks}
                    onChange={(e) => setProfileForm({ ...profileForm, portfolioLinks: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Pricing</Label>
                  <Input
                    value={profileForm.pricing}
                    onChange={(e) => setProfileForm({ ...profileForm, pricing: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Availability</Label>
                  <Input
                    value={profileForm.availability}
                    onChange={(e) => setProfileForm({ ...profileForm, availability: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Socials (comma-separated key:value)</Label>
                  <Input
                    value={profileForm.socials}
                    onChange={(e) => setProfileForm({ ...profileForm, socials: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Verification Docs (comma-separated)</Label>
                  <Input
                    value={profileForm.verificationDocs}
                    onChange={(e) => setProfileForm({ ...profileForm, verificationDocs: e.target.value })}
                  />
                </div>
                <Button
                  onClick={() => updateProfileMutation.mutate()}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <CardTitle>Bookings</CardTitle>
                <CardDescription>Manage your client bookings and track payments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!userBookings?.length ? (
                  <div className="text-muted-foreground text-center py-8">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p>No bookings yet. Share your booking link to get started!</p>
                  </div>
                ) : (
                  userBookings.map((booking) => {
                    const statusColor =
                      booking.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                      booking.status === "completed" ? "bg-green-100 text-green-800" :
                      booking.status === "cancelled" || booking.status === "declined" ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800";
                    return (
                      <Card key={booking.id} className="border-l-4 border-l-green-500">
                        <CardContent className="p-4">
                          {/* Header with service type and status */}
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="font-semibold text-lg capitalize">
                                {booking.serviceType} - {booking.packageType}
                              </div>
                              <div className="text-sm font-medium text-green-700">
                                ${booking.totalPrice.toLocaleString()}
                              </div>
                            </div>
                            <Badge className={statusColor}>
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </Badge>
                          </div>

                          {/* Client Info */}
                          <div className="bg-gray-50 rounded-lg p-3 mb-4">
                            <div className="text-sm font-medium text-gray-700 mb-2">Client Details</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span>{booking.clientName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <a href={`mailto:${booking.email}`} className="text-blue-600 hover:underline">
                                  {booking.email}
                                </a>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <a href={`tel:${booking.contactNumber}`} className="text-blue-600 hover:underline">
                                  {booking.contactNumber}
                                </a>
                              </div>
                            </div>
                          </div>

                          {/* Shoot Details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>{booking.shootDate} at {booking.shootTime}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span>{booking.location}, {booking.parish}</span>
                              </div>
                              {booking.numberOfPeople > 1 && (
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                  <span>{booking.numberOfPeople} people</span>
                                </div>
                              )}
                            </div>

                            {/* Payment Status */}
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="text-sm font-medium text-gray-700 mb-2">Payment Status</div>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span>Deposit (${booking.depositAmount}):</span>
                                  <Badge className={booking.depositPaid ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                                    {booking.depositPaid ? "Paid" : "Pending"}
                                  </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span>Balance (${booking.balanceDue}):</span>
                                  <Badge className={booking.balancePaid ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                                    {booking.balancePaid ? "Paid" : "Pending"}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Add-ons if any */}
                          {booking.addons && booking.addons.length > 0 && (
                            <div className="mb-4">
                              <div className="text-sm font-medium text-gray-700 mb-1">Add-ons</div>
                              <div className="flex flex-wrap gap-1">
                                {booking.addons.map((addon, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {addon}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Status Update */}
                          <div className="border-t pt-4 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                              <Select
                                value={bookingStatusDraft[booking.id] || booking.status}
                                onValueChange={(value) =>
                                  setBookingStatusDraft((prev) => ({ ...prev, [booking.id]: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Update status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                  <SelectItem value="declined">Declined</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={() =>
                                  updateBookingStatusMutation.mutate({
                                    bookingId: booking.id,
                                    status: bookingStatusDraft[booking.id] || booking.status,
                                  })
                                }
                                disabled={updateBookingStatusMutation.isPending}
                              >
                                {updateBookingStatusMutation.isPending ? "Saving..." : "Update Status"}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="galleries">
            <div className="space-y-4">
              {!userGalleries?.length ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Camera className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No galleries assigned yet.</p>
                  </CardContent>
                </Card>
              ) : (
                userGalleries.map((gallery) => (
                  <Card key={gallery.id} className="border-green-100">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-semibold text-green-900">
                          Gallery #{gallery.id.slice(-8)}
                        </span>
                        <Badge className="bg-green-100 text-green-800 text-[10px]">
                          {gallery.status}
                        </Badge>
                      </div>

                      {/* Three image sections */}
                      {(["gallery", "selected", "final"] as GalleryImageType[]).map((type) => {
                        const images = type === "gallery" ? gallery.galleryImages || []
                          : type === "selected" ? gallery.selectedImages || []
                          : gallery.finalImages || [];
                        const fileInputId = `ph-${gallery.id}-${type}`;
                        return (
                          <div key={type} className="mb-5">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium capitalize text-green-800">
                                {type} ({images.length})
                              </h5>
                              <Button size="sm" variant="outline" asChild
                                className="h-6 text-xs px-2 border-green-200 text-green-700 hover:bg-green-50 cursor-pointer">
                                <label htmlFor={fileInputId}>
                                  <Upload className="w-3 h-3 mr-1" /> Upload
                                </label>
                              </Button>
                            </div>

                            <input
                              id={fileInputId}
                              type="file"
                              accept="image/*"
                              multiple
                              className="sr-only"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleGalFilesSelected(Array.from(e.target.files), gallery, type);
                                  e.target.value = "";
                                }
                              }}
                            />

                            {images.length === 0 ? (
                              <label
                                htmlFor={fileInputId}
                                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-green-200 py-6 text-sm text-green-500 hover:border-green-400 hover:bg-green-50 transition-colors cursor-pointer"
                              >
                                <Upload className="w-5 h-5 opacity-60" />
                                Tap to upload
                              </label>
                            ) : (
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {images.map((url, i) => {
                                  const dragging = galDragSrc?.galleryId === gallery.id && galDragSrc?.type === type && galDragSrc?.index === i;
                                  const over     = galDragOver?.galleryId === gallery.id && galDragOver?.type === type && galDragOver?.index === i;
                                  return (
                                    <div
                                      key={`${url}-${i}`}
                                      draggable
                                      onDragStart={() => handleGalDragStart(gallery.id, type, i)}
                                      onDragOver={(e) => handleGalDragOver(e, gallery.id, type, i)}
                                      onDrop={() => handleGalDrop(gallery, type, i)}
                                      onDragEnd={handleGalDragEnd}
                                      className={`relative group aspect-square rounded overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${
                                        dragging ? "opacity-40 scale-95 border-green-400"
                                        : over    ? "border-green-500 scale-[1.03] shadow-md"
                                        : "bg-green-100 border-green-200"
                                      }`}
                                    >
                                      <img src={url} alt="" className="w-full h-full object-cover" />
                                      <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 pointer-events-none">
                                        <GripVertical className="w-3 h-3 text-white drop-shadow" />
                                      </div>
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                                        <button onClick={() => setGalPreview(url)}
                                          className="p-1 bg-white/90 rounded-full shadow">
                                          <Eye className="w-2.5 h-2.5 text-gray-700" />
                                        </button>
                                        <button onClick={() => handleGalRemove(gallery, type, url)}
                                          className="p-1 bg-white/90 rounded-full shadow">
                                          <X className="w-2.5 h-2.5 text-red-500" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {/* Add-more */}
                                <label
                                  htmlFor={fileInputId}
                                  className="aspect-square rounded border-2 border-dashed border-green-200 flex flex-col items-center justify-center text-green-400 hover:border-green-400 hover:bg-green-50 cursor-pointer transition-colors"
                                >
                                  <Upload className="w-3.5 h-3.5 mb-0.5" />
                                  <span className="text-[9px]">Add</span>
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Upload progress panel */}
            {showGalUploadPanel && galUploadItems.length > 0 && (() => {
              const done       = galUploadItems.filter((i) => i.status === "done").length;
              const errors     = galUploadItems.filter((i) => i.status === "error").length;
              const duplicates = galUploadItems.filter((i) => i.status === "duplicate").length;
              const uploadable = galUploadItems.filter((i) => i.status !== "duplicate");
              const total      = uploadable.length;
              const pct        = total === 0 ? 100 : Math.round(uploadable.reduce((s, i) => s + (i.status === "done" ? 100 : i.progress), 0) / total);
              const canClose   = galUploadItems.every((i) => ["done","error","duplicate"].includes(i.status));
              return (
                <Dialog open onOpenChange={(open) => { if (!open && canClose) closeGalUploadPanel(); }}>
                  <DialogContent className="max-w-md w-[95vw] p-0 overflow-hidden rounded-2xl gap-0"
                    onInteractOutside={(e) => { if (!canClose) e.preventDefault(); }}>
                    <div className="bg-gradient-to-r from-green-800 to-green-700 px-5 py-4 text-white">
                      <p className="text-sm font-semibold mb-1.5">
                        {canClose ? `Done — ${done} saved${duplicates > 0 ? `, ${duplicates} skipped` : ""}${errors > 0 ? `, ${errors} failed` : ""}` : `Saving ${done} / ${total} photos…`}
                      </p>
                      <div className="flex items-center gap-3">
                        <Progress value={pct} className="flex-1 h-1.5 bg-white/20 [&>div]:bg-yellow-400" />
                        <span className="text-xs text-white/70 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto p-3 bg-green-50">
                      <div className="grid grid-cols-3 gap-2">
                        {galUploadItems.map((item) => (
                          <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden bg-green-100 ring-1 ring-green-200">
                            <img src={item.preview} alt="" className="w-full h-full object-cover" />
                            <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                              item.status === "uploading" ? "bg-black/20" : item.status === "done" ? "bg-green-700/60" : item.status === "duplicate" ? "bg-amber-500/75" : item.status === "error" ? "bg-red-500/70" : "bg-black/25"
                            }`}>
                              {item.status === "uploading" && <Loader2 className="w-5 h-5 text-white animate-spin" />}
                              {item.status === "done"      && <CheckCircle2 className="w-7 h-7 text-white" />}
                              {item.status === "duplicate" && <Copy className="w-5 h-5 text-white" />}
                              {item.status === "error"     && <AlertCircle className="w-5 h-5 text-white" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="px-4 py-3 border-t border-green-100 bg-white flex justify-between items-center gap-3">
                      <p className="text-xs text-green-700">
                        {canClose ? "All photos saved to Connectagrapher" : "Saving photos to Connectagrapher…"}
                      </p>
                      <Button size="sm" onClick={closeGalUploadPanel} disabled={!canClose}
                        className={canClose ? "bg-green-700 hover:bg-green-800 text-white" : ""}>
                        {canClose ? "Done" : <><Loader2 className="w-3 h-3 animate-spin mr-1" />Uploading</>}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              );
            })()}

            {/* Preview dialog */}
            <Dialog open={!!galPreview} onOpenChange={(open) => !open && setGalPreview(null)}>
              <DialogContent className="max-w-4xl p-2 bg-black/95 border-0">
                <img src={galPreview || ""} alt="" className="w-full h-auto max-h-[85vh] object-contain rounded" />
              </DialogContent>
            </Dialog>
          </TabsContent>
          
          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle>Package Pricing</CardTitle>
                <CardDescription>
                  Customize your pricing for different service types and packages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Quick Stats */}
                {(() => {
                  try {
                    const config = JSON.parse(pricingRaw) as PricingConfig;
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm text-muted-foreground">Photoshoot Bronze</div>
                          <div className="text-lg font-semibold">${config.packages.photoshoot.photography.bronze.price}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Photoshoot Platinum</div>
                          <div className="text-lg font-semibold">${config.packages.photoshoot.photography.platinum.price}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Wedding Bronze</div>
                          <div className="text-lg font-semibold">${config.packages.wedding.photography.bronze}</div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Wedding Platinum</div>
                          <div className="text-lg font-semibold">${config.packages.wedding.photography.platinum}</div>
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}

                {/* Help Text */}
                <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
                  <strong>Pricing Structure:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>Photoshoot packages</strong>: Include price, duration (minutes), images, and locations</li>
                    <li><strong>Wedding packages</strong>: Simple price values for each tier</li>
                    <li><strong>Event pricing</strong>: Base rate per hour with minimum hours</li>
                    <li><strong>Add-ons</strong>: Extra services like drone, express delivery, etc.</li>
                    <li><strong>Fees</strong>: Additional person fee and transportation by region</li>
                  </ul>
                </div>

                {/* JSON Editor */}
                <div>
                  <Label className="mb-2 block">Pricing Configuration (JSON)</Label>
                  <Textarea
                    rows={20}
                    value={pricingRaw}
                    onChange={(event) => setPricingRaw(event.target.value)}
                    className="font-mono text-xs"
                    placeholder="Loading pricing configuration..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(pricingRaw) as PricingConfig;
                        updatePricingMutation.mutate(parsed);
                      } catch (error) {
                        toast({
                          title: "Invalid JSON",
                          description: "Please fix the JSON formatting before saving.",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={updatePricingMutation.isPending}
                  >
                    {updatePricingMutation.isPending ? "Saving..." : "Save Pricing"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPricingRaw(JSON.stringify(defaultPricingConfig, null, 2));
                      toast({ title: "Reset to defaults", description: "Save to apply the default pricing." });
                    }}
                  >
                    Reset to Defaults
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(pricingRaw);
                        setPricingRaw(JSON.stringify(parsed, null, 2));
                        toast({ title: "Formatted", description: "JSON has been formatted." });
                      } catch {
                        toast({ title: "Invalid JSON", description: "Cannot format invalid JSON.", variant: "destructive" });
                      }
                    }}
                  >
                    Format JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
