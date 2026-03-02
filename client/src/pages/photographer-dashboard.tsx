import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { defaultPricingConfig, type PricingConfig } from "@shared/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ChatPanel } from "@/components/chat-panel";
import {
  Camera, Calendar, User, Clock, CheckCircle, Upload, Phone, Mail,
  MapPin, DollarSign, Users, GripVertical, X, Eye, Loader2, CheckCircle2,
  AlertCircle, Copy, MessageSquare, LayoutDashboard, LogOut,
  Link as LinkIcon, Plus, Image as GalleryIcon, ChevronRight, Tag, Save,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "profile" | "bookings" | "galleries" | "pricing" | "chat";

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
  galleryDownloadEnabled: boolean;
  selectedDownloadEnabled: boolean;
  finalDownloadEnabled: boolean;
  createdAt: string;
}

type GalleryImageType = "gallery" | "selected" | "final";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", placeholder: "@username" },
  { key: "facebook",  label: "Facebook",  placeholder: "page URL" },
  { key: "tiktok",    label: "TikTok",    placeholder: "@username" },
  { key: "twitter",   label: "X / Twitter", placeholder: "@handle" },
  { key: "youtube",   label: "YouTube",   placeholder: "channel URL" },
  { key: "website",   label: "Website",   placeholder: "https://..." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function statusColor(s: string) {
  return s === "confirmed" ? "bg-blue-100 text-blue-800"
    : s === "completed"   ? "bg-green-100 text-green-800"
    : s === "cancelled" || s === "declined" ? "bg-red-100 text-red-800"
    : "bg-yellow-100 text-yellow-800";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PhotographerDashboard() {
  const { user, isLoading, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Navigation
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Profile form — arrays instead of CSV strings
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    bio: "",
    location: "",
    specialties: [] as string[],
    portfolioLinks: [] as string[],
    pricing: "",
    availability: "",
    phone: "",
    socials: {} as Record<string, string>,
  });
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [portfolioInput, setPortfolioInput] = useState("");

  // Pricing
  const [pricingRaw, setPricingRaw] = useState(JSON.stringify(defaultPricingConfig, null, 2));

  // Bookings
  const [bookingStatusDraft, setBookingStatusDraft] = useState<Record<string, string>>({});
  const [bookingFilter, setBookingFilter] = useState<"all" | "upcoming" | "confirmed" | "completed" | "cancelled">("all");

  // Gallery
  const [galDragSrc, setGalDragSrc] = useState<{ galleryId: string; type: GalleryImageType; index: number } | null>(null);
  const [galDragOver, setGalDragOver] = useState<{ galleryId: string; type: GalleryImageType; index: number } | null>(null);
  const [galPreview, setGalPreview] = useState<string | null>(null);
  const [galUploadItems, setGalUploadItems] = useState<UploadFileItem[]>([]);
  const [showGalUploadPanel, setShowGalUploadPanel] = useState(false);

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState("");
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

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

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/conversations/unread-count"],
    refetchInterval: 4000,
    enabled: !!user,
    retry: false,
  });
  const unreadCount = unreadData?.count ?? 0;

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoading && !user) setLocation("/auth");
    if (!isLoading && user?.role === "client") setLocation("/dashboard");
  }, [isLoading, user, setLocation]);

  useEffect(() => {
    if (profileData?.profile) {
      const p = profileData.profile;
      setProfileForm({
        displayName: p.displayName ?? "",
        bio: p.bio ?? "",
        location: p.location ?? "",
        specialties: p.specialties ?? [],
        portfolioLinks: p.portfolioLinks ?? [],
        pricing: p.pricing ?? "",
        availability: p.availability ?? "",
        phone: p.phone ?? "",
        socials: p.socials ?? {},
      });
    }
  }, [profileData]);

  useEffect(() => {
    if (pricingData?.config) {
      setPricingRaw(JSON.stringify(pricingData.config, null, 2));
    }
  }, [pricingData]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/photographer/profile", {
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        location: profileForm.location,
        specialties: profileForm.specialties,
        portfolioLinks: profileForm.portfolioLinks,
        pricing: profileForm.pricing,
        availability: profileForm.availability,
        phone: profileForm.phone,
        socials: profileForm.socials,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/profile"] });
      toast({ title: "Profile updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
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
    onError: (e: Error) => toast({ title: "Pricing update failed", description: e.message, variant: "destructive" }),
  });

  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      await apiRequest("PATCH", `/api/photographer/bookings/${bookingId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/photographer/bookings"] });
      toast({ title: "Booking status updated" });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const addImageMutation = useMutation({
    mutationFn: async ({ galleryId, imageURL, type }: { galleryId: string; imageURL: string; type: string }) => {
      await apiRequest("PUT", "/api/photographer/gallery-images", { galleryId, imageURL, type });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/photographer/galleries"] }),
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const updateGalleryImagesMutation = useMutation({
    mutationFn: async ({ galleryId, images, type }: { galleryId: string; images: string[]; type: GalleryImageType }) => {
      await apiRequest("PATCH", `/api/photographer/gallery/${galleryId}/images`, { images, type });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/photographer/galleries"] }),
    onError: () => toast({ title: "Failed to update gallery", variant: "destructive" }),
  });

  const updateGallerySettingsMutation = useMutation({
    mutationFn: async ({ galleryId, settings }: { galleryId: string; settings: Record<string, boolean | string> }) => {
      await apiRequest("PATCH", `/api/photographer/gallery/${galleryId}/settings`, settings);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/photographer/galleries"] }),
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  // ── Gallery drag handlers ──────────────────────────────────────────────────

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

  // ── Gallery upload ─────────────────────────────────────────────────────────

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

  // ── Avatar upload ──────────────────────────────────────────────────────────

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const sigRes = await apiRequest("POST", "/api/user/upload-signature");
      const { cloudName, apiKey, signature, timestamp, folder } = await sigRes.json();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      if (folder) formData.append("folder", folder);
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST", body: formData,
      });
      const uploadData = await uploadRes.json();
      const url = uploadData.secure_url;
      setLocalAvatarUrl(url);
      await apiRequest("PATCH", "/api/user/profile", { profileImageUrl: url });
      toast({ title: "Photo updated" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  const status = profileData?.status ?? user?.photographerStatus;
  const displayName = profileData?.profile?.displayName || `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Photographer";
  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") || "P";
  const avatarUrl = localAvatarUrl || (user as any)?.profileImageUrl || "";
  const bookingLink = typeof window !== "undefined" ? `${window.location.origin}/book/${user?.id}` : "";

  const totalRevenue = userBookings?.reduce((s, b) => s + b.totalPrice, 0) ?? 0;
  const collectedRevenue = userBookings?.reduce((s, b) => s + (b.depositPaid ? b.depositAmount : 0) + (b.balancePaid ? b.balanceDue : 0), 0) ?? 0;
  const pendingRevenue = totalRevenue - collectedRevenue;
  const pendingCount = userBookings?.filter(b => b.status === "pending").length ?? 0;
  const confirmedCount = userBookings?.filter(b => b.status === "confirmed").length ?? 0;
  const completedCount = userBookings?.filter(b => b.status === "completed").length ?? 0;

  const filteredBookings = useMemo(() => {
    if (!userBookings) return [];
    switch (bookingFilter) {
      case "upcoming":   return userBookings.filter(b => !["completed", "cancelled", "declined"].includes(b.status));
      case "confirmed":  return userBookings.filter(b => b.status === "confirmed");
      case "completed":  return userBookings.filter(b => b.status === "completed");
      case "cancelled":  return userBookings.filter(b => ["cancelled", "declined"].includes(b.status));
      default:           return userBookings;
    }
  }, [userBookings, bookingFilter]);

  const upcomingBookings = useMemo(() => {
    if (!userBookings) return [];
    return [...userBookings]
      .filter(b => !["completed", "cancelled", "declined"].includes(b.status))
      .sort((a, b) => a.shootDate.localeCompare(b.shootDate))
      .slice(0, 3);
  }, [userBookings]);

  const navItems: { id: Tab; label: string; icon: React.ElementType; badge: number }[] = [
    { id: "overview",  label: "Overview",  icon: LayoutDashboard, badge: 0 },
    { id: "profile",   label: "Profile",   icon: User,            badge: 0 },
    { id: "bookings",  label: "Bookings",  icon: Calendar,        badge: pendingCount },
    { id: "galleries", label: "Galleries", icon: Camera,          badge: 0 },
    { id: "pricing",   label: "Pricing",   icon: DollarSign,      badge: 0 },
    { id: "chat",      label: "Chat",      icon: MessageSquare,   badge: unreadCount },
  ];

  const copyBookingLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      toast({ title: "Booking link copied" });
    } catch {
      toast({ title: "Copy failed", description: "Copy the link manually.", variant: "destructive" });
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!user) return <Redirect to="/auth" />;

  // ── Render ─────────────────────────────────────────────────────────────────

  const approvalBadgeClass =
    status === "approved" ? "bg-green-100 text-green-700 border-green-200"
    : status === "rejected" ? "bg-red-100 text-red-700 border-red-200"
    : "bg-yellow-100 text-yellow-700 border-yellow-200";

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r fixed top-0 left-0 h-screen z-20">
        {/* Brand */}
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm text-primary">ConnectAgrapher</span>
          </div>
        </div>

        {/* Photographer info */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2.5">
            <Avatar className="w-9 h-9 shrink-0">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-sm font-medium">{initials.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight truncate">{displayName}</p>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 mt-0.5 ${approvalBadgeClass}`}>
                {status ? capitalize(status) : "Pending"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === item.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-gray-100 hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge > 0 && (
                <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-4">{item.badge}</Badge>
              )}
            </button>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="px-2 py-3 border-t space-y-0.5">
          <button
            onClick={copyBookingLink}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors"
          >
            <LinkIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Copy booking link</span>
          </button>
          <button
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col md:ml-56 min-h-screen">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-10 bg-white border-b px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-xs">{initials.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="font-semibold text-sm truncate max-w-[160px]">{displayName}</span>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Approval banner */}
        {status !== "approved" && (
          <div className="bg-amber-50 border-b border-amber-100 px-4 md:px-6 py-2.5 flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Your account is pending approval. Complete your profile while we review your details.</span>
          </div>
        )}

        {/* Page title bar */}
        <div className="bg-white border-b px-4 md:px-6 py-4">
          <h1 className="font-semibold text-lg">
            {navItems.find(n => n.id === activeTab)?.label ?? "Dashboard"}
          </h1>
        </div>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-6 max-w-4xl">
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Bookings", value: String(userBookings?.length ?? 0), sub: `${confirmedCount} confirmed · ${completedCount} completed`, icon: Calendar, color: "text-primary" },
                  { label: "Total Revenue", value: `$${totalRevenue.toLocaleString()}`, sub: "All bookings value", icon: DollarSign, color: "text-primary" },
                  { label: "Collected", value: `$${collectedRevenue.toLocaleString()}`, sub: "Payments received", icon: CheckCircle, color: "text-green-600" },
                  { label: "Pending", value: `$${pendingRevenue.toLocaleString()}`, sub: "Awaiting payment", icon: Clock, color: "text-orange-500" },
                ].map(stat => (
                  <Card key={stat.label}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                        <stat.icon className={`w-4 h-4 ${stat.color} opacity-70`} />
                      </div>
                      <div className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
                      <p className="text-xs text-muted-foreground">{stat.sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Upcoming Bookings */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Upcoming Bookings</CardTitle>
                    {(userBookings?.length ?? 0) > 3 && (
                      <button
                        onClick={() => setActiveTab("bookings")}
                        className="text-xs text-primary flex items-center gap-1 hover:underline"
                      >
                        View all <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No upcoming bookings. Share your booking link to get started!</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {upcomingBookings.map(b => (
                        <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{b.clientName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{b.serviceType} · {b.shootDate}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-[10px] px-2 py-0.5 ${statusColor(b.status)}`}>{capitalize(b.status)}</Badge>
                            <span className="text-sm font-semibold text-primary">${b.totalPrice.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Booking link */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Your Booking Link</CardTitle>
                  <p className="text-sm text-muted-foreground">Share this link with clients so they can book you directly.</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-2">
                    <Input value={bookingLink} readOnly className="text-xs" />
                    <Button variant="outline" onClick={copyBookingLink} className="shrink-0">
                      <Copy className="w-4 h-4 mr-1.5" /> Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── PROFILE ── */}
          {activeTab === "profile" && (
            <div className="max-w-2xl space-y-6">
              <Card className="overflow-hidden">
                {/* Cover + Avatar */}
                <div className="h-24 bg-gradient-to-r from-primary/20 to-secondary/20" />
                <div className="px-6 pb-4">
                  <div className="flex items-end gap-4 -mt-12 mb-4">
                    <div className="relative shrink-0">
                      <Avatar className="w-24 h-24 ring-4 ring-background shadow">
                        <AvatarImage src={avatarUrl || undefined} />
                        <AvatarFallback className="text-2xl font-semibold">{initials.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        onClick={() => avatarFileRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 shadow hover:bg-primary/90"
                      >
                        {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      </button>
                      <input ref={avatarFileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
                    </div>
                    <div className="mb-1">
                      <p className="font-semibold text-lg">{displayName}</p>
                      <Badge variant="outline" className={`text-xs ${approvalBadgeClass} mt-0.5`}>
                        {status ? capitalize(status) : "Pending"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Display Name</Label>
                        <Input value={profileForm.displayName}
                          onChange={e => setProfileForm(f => ({ ...f, displayName: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Phone</Label>
                        <Input value={profileForm.phone} placeholder="+1 (876) 000-0000"
                          onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Bio</Label>
                      <Textarea rows={4} value={profileForm.bio} placeholder="Tell clients about yourself…"
                        onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Location</Label>
                        <Input value={profileForm.location} placeholder="Kingston, Jamaica"
                          onChange={e => setProfileForm(f => ({ ...f, location: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label>Availability</Label>
                        <Input value={profileForm.availability} placeholder="Weekends, evenings…"
                          onChange={e => setProfileForm(f => ({ ...f, availability: e.target.value }))} />
                      </div>
                    </div>

                    {/* Specialties — tag chips */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Specialties</Label>
                      <div className="flex flex-wrap gap-2 min-h-[32px]">
                        {profileForm.specialties.map(s => (
                          <span key={s} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                            {s}
                            <button type="button" onClick={() => setProfileForm(f => ({ ...f, specialties: f.specialties.filter(x => x !== s) }))}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={specialtyInput}
                          placeholder="Add specialty (press Enter)"
                          onChange={e => setSpecialtyInput(e.target.value)}
                          onKeyDown={e => {
                            if ((e.key === "Enter" || e.key === ",") && specialtyInput.trim()) {
                              e.preventDefault();
                              const val = specialtyInput.trim().replace(/,$/, "");
                              if (val && !profileForm.specialties.includes(val)) {
                                setProfileForm(f => ({ ...f, specialties: [...f.specialties, val] }));
                              }
                              setSpecialtyInput("");
                            }
                          }}
                        />
                        <Button type="button" variant="outline" size="sm"
                          onClick={() => {
                            const val = specialtyInput.trim();
                            if (val && !profileForm.specialties.includes(val)) {
                              setProfileForm(f => ({ ...f, specialties: [...f.specialties, val] }));
                            }
                            setSpecialtyInput("");
                          }}
                        ><Plus className="w-4 h-4" /></Button>
                      </div>
                    </div>

                    {/* Portfolio Links */}
                    <div className="space-y-2">
                      <Label>Portfolio Links</Label>
                      <div className="space-y-2">
                        {profileForm.portfolioLinks.map((url, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <Input value={url} readOnly className="text-xs bg-muted" />
                            <button type="button" onClick={() => setProfileForm(f => ({ ...f, portfolioLinks: f.portfolioLinks.filter((_, j) => j !== i) }))}>
                              <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input value={portfolioInput} placeholder="https://…"
                            onChange={e => setPortfolioInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && portfolioInput.trim()) {
                                e.preventDefault();
                                setProfileForm(f => ({ ...f, portfolioLinks: [...f.portfolioLinks, portfolioInput.trim()] }));
                                setPortfolioInput("");
                              }
                            }}
                          />
                          <Button type="button" variant="outline" size="sm"
                            onClick={() => {
                              if (portfolioInput.trim()) {
                                setProfileForm(f => ({ ...f, portfolioLinks: [...f.portfolioLinks, portfolioInput.trim()] }));
                                setPortfolioInput("");
                              }
                            }}
                          ><Plus className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </div>

                    {/* Social platforms */}
                    <div className="space-y-2">
                      <Label>Social Platforms</Label>
                      <div className="space-y-2">
                        {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
                          <div key={key} className="grid grid-cols-[100px_1fr] gap-2 items-center">
                            <span className="text-xs text-muted-foreground font-medium">{label}</span>
                            <Input
                              value={profileForm.socials[key] ?? ""}
                              placeholder={placeholder}
                              onChange={e => setProfileForm(f => ({
                                ...f,
                                socials: e.target.value
                                  ? { ...f.socials, [key]: e.target.value }
                                  : Object.fromEntries(Object.entries(f.socials).filter(([k]) => k !== key))
                              }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Pricing Description</Label>
                      <Input value={profileForm.pricing} placeholder="e.g. Starting from $200/hr"
                        onChange={e => setProfileForm(f => ({ ...f, pricing: e.target.value }))} />
                    </div>

                    <Button onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending} className="w-full">
                      {updateProfileMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save Profile</>}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── BOOKINGS ── */}
          {activeTab === "bookings" && (
            <div className="max-w-3xl space-y-4">
              {/* Filter strip */}
              <div className="flex gap-2 flex-wrap">
                {(["all", "upcoming", "confirmed", "completed", "cancelled"] as const).map(f => (
                  <button key={f} onClick={() => setBookingFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      bookingFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-white border text-muted-foreground hover:bg-gray-50"
                    }`}
                  >
                    {capitalize(f)}
                    {f === "all" && (userBookings?.length ?? 0) > 0 && <span className="ml-1.5 text-xs opacity-70">{userBookings?.length}</span>}
                  </button>
                ))}
              </div>

              {filteredBookings.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{(userBookings?.length ?? 0) === 0 ? "No bookings yet. Share your booking link to get started!" : "No bookings match this filter."}</p>
                  </CardContent>
                </Card>
              ) : (
                filteredBookings.map(booking => (
                  <Card key={booking.id} className="overflow-hidden">
                    {/* Card header strip */}
                    <div className="px-5 py-4 border-b bg-gray-50/60 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold capitalize">{booking.serviceType} — {capitalize(booking.packageType)}</p>
                        <p className="text-lg font-bold text-primary mt-0.5">${booking.totalPrice.toLocaleString()}</p>
                      </div>
                      <Badge className={`mt-1 ${statusColor(booking.status)}`}>{capitalize(booking.status)}</Badge>
                    </div>

                    <CardContent className="p-5 space-y-4">
                      {/* Client info */}
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                        <span className="flex items-center gap-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />{booking.clientName}
                        </span>
                        <a href={`mailto:${booking.email}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                          <Mail className="w-3.5 h-3.5" />{booking.email}
                        </a>
                        <a href={`tel:${booking.contactNumber}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                          <Phone className="w-3.5 h-3.5" />{booking.contactNumber}
                        </a>
                      </div>

                      {/* Shoot details */}
                      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />{booking.shootDate} at {booking.shootTime}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />{booking.location}, {booking.parish}
                        </span>
                        {booking.numberOfPeople > 1 && (
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />{booking.numberOfPeople} people
                          </span>
                        )}
                      </div>

                      {/* Payment */}
                      <div className="flex gap-3 text-sm">
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-muted-foreground">Deposit ${booking.depositAmount}</span>
                          <Badge className={booking.depositPaid ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"} variant="outline">
                            {booking.depositPaid ? "Paid" : "Pending"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-muted-foreground">Balance ${booking.balanceDue}</span>
                          <Badge className={booking.balancePaid ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"} variant="outline">
                            {booking.balancePaid ? "Paid" : "Pending"}
                          </Badge>
                        </div>
                      </div>

                      {/* Add-ons */}
                      {booking.addons && booking.addons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {booking.addons.map((a, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Status update */}
                      <div className="flex gap-2 pt-1 border-t">
                        <Select
                          value={bookingStatusDraft[booking.id] || booking.status}
                          onValueChange={v => setBookingStatusDraft(p => ({ ...p, [booking.id]: v }))}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["pending", "confirmed", "completed", "cancelled", "declined"].map(s => (
                              <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => updateBookingStatusMutation.mutate({
                            bookingId: booking.id,
                            status: bookingStatusDraft[booking.id] || booking.status,
                          })}
                          disabled={updateBookingStatusMutation.isPending}
                          size="sm"
                        >
                          {updateBookingStatusMutation.isPending ? "Saving…" : "Update"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ── GALLERIES ── */}
          {activeTab === "galleries" && (
            <div className="space-y-4 max-w-4xl">
              {!userGalleries?.length ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Camera className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No galleries assigned yet.</p>
                  </CardContent>
                </Card>
              ) : (
                userGalleries.map(gallery => {
                  const booking = userBookings?.find(b => b.id === gallery.bookingId);
                  return (
                    <Card key={gallery.id}>
                      {/* Gallery header */}
                      <div className="px-5 py-3.5 border-b bg-gray-50/60 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">
                            {booking ? `${booking.clientName} — ${capitalize(booking.serviceType)}` : `Gallery #${gallery.id.slice(-8)}`}
                          </p>
                          {booking && <p className="text-xs text-muted-foreground">{booking.shootDate}</p>}
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">{gallery.status}</Badge>
                      </div>

                      <CardContent className="p-5">
                        {/* Download toggles */}
                        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {([
                            { key: "galleryDownloadEnabled" as const,  label: "Gallery downloads" },
                            { key: "selectedDownloadEnabled" as const, label: "Selected downloads" },
                            { key: "finalDownloadEnabled" as const,    label: "Final downloads" },
                          ]).map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                              <span className="text-xs font-medium text-muted-foreground">{label}</span>
                              <Switch
                                checked={gallery[key] ?? false}
                                onCheckedChange={checked => updateGallerySettingsMutation.mutate({ galleryId: gallery.id, settings: { [key]: checked } })}
                              />
                            </div>
                          ))}
                        </div>

                        {/* Image sections */}
                        {(["gallery", "selected", "final"] as GalleryImageType[]).map(type => {
                          const images = type === "gallery" ? gallery.galleryImages || []
                            : type === "selected" ? gallery.selectedImages || []
                            : gallery.finalImages || [];
                          const fileInputId = `ph-${gallery.id}-${type}`;
                          return (
                            <div key={type} className="mb-5 last:mb-0">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-sm font-medium capitalize text-foreground">
                                  {type} <span className="text-muted-foreground font-normal">({images.length})</span>
                                </h5>
                                <Button size="sm" variant="outline" asChild className="h-6 text-xs px-2">
                                  <label htmlFor={fileInputId} className="cursor-pointer">
                                    <Upload className="w-3 h-3 mr-1" /> Upload
                                  </label>
                                </Button>
                              </div>
                              <input id={fileInputId} type="file" accept="image/*" multiple className="sr-only"
                                onChange={e => { if (e.target.files?.length) { handleGalFilesSelected(Array.from(e.target.files), gallery, type); e.target.value = ""; } }} />
                              {images.length === 0 ? (
                                <label htmlFor={fileInputId}
                                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted py-6 text-sm text-muted-foreground hover:border-primary/40 hover:bg-muted/30 transition-colors cursor-pointer">
                                  <Upload className="w-5 h-5 opacity-40" />
                                  Tap to upload
                                </label>
                              ) : (
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                                  {images.map((url, i) => {
                                    const dragging = galDragSrc?.galleryId === gallery.id && galDragSrc?.type === type && galDragSrc?.index === i;
                                    const over     = galDragOver?.galleryId === gallery.id && galDragOver?.type === type && galDragOver?.index === i;
                                    return (
                                      <div key={`${url}-${i}`} draggable
                                        onDragStart={() => handleGalDragStart(gallery.id, type, i)}
                                        onDragOver={e => handleGalDragOver(e, gallery.id, type, i)}
                                        onDrop={() => handleGalDrop(gallery, type, i)}
                                        onDragEnd={handleGalDragEnd}
                                        className={`relative group aspect-square rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${
                                          dragging ? "opacity-40 scale-95 border-primary/60"
                                          : over    ? "border-primary scale-[1.03] shadow-md"
                                          : "border-muted bg-muted/30"
                                        }`}
                                      >
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-100 pointer-events-none">
                                          <GripVertical className="w-3 h-3 text-white drop-shadow" />
                                        </div>
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                                          <button onClick={() => setGalPreview(url)} className="p-1 bg-white/90 rounded-full shadow">
                                            <Eye className="w-2.5 h-2.5 text-gray-700" />
                                          </button>
                                          <button onClick={() => handleGalRemove(gallery, type, url)} className="p-1 bg-white/90 rounded-full shadow">
                                            <X className="w-2.5 h-2.5 text-red-500" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <label htmlFor={fileInputId}
                                    className="aspect-square rounded-lg border-2 border-dashed border-muted flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:bg-muted/20 cursor-pointer transition-colors">
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
                  );
                })
              )}

              {/* Upload progress panel */}
              {showGalUploadPanel && galUploadItems.length > 0 && (() => {
                const done       = galUploadItems.filter(i => i.status === "done").length;
                const errors     = galUploadItems.filter(i => i.status === "error").length;
                const duplicates = galUploadItems.filter(i => i.status === "duplicate").length;
                const uploadable = galUploadItems.filter(i => i.status !== "duplicate");
                const total      = uploadable.length;
                const pct        = total === 0 ? 100 : Math.round(uploadable.reduce((s, i) => s + (i.status === "done" ? 100 : i.progress), 0) / total);
                const canClose   = galUploadItems.every(i => ["done", "error", "duplicate"].includes(i.status));
                return (
                  <Dialog open onOpenChange={open => { if (!open && canClose) closeGalUploadPanel(); }}>
                    <DialogContent className="max-w-md w-[95vw] p-0 overflow-hidden rounded-2xl gap-0"
                      onInteractOutside={e => { if (!canClose) e.preventDefault(); }}>
                      <div className="bg-gradient-to-r from-primary to-primary/80 px-5 py-4 text-white">
                        <p className="text-sm font-semibold mb-1.5">
                          {canClose ? `Done — ${done} saved${duplicates > 0 ? `, ${duplicates} skipped` : ""}${errors > 0 ? `, ${errors} failed` : ""}` : `Saving ${done} / ${total} photos…`}
                        </p>
                        <div className="flex items-center gap-3">
                          <Progress value={pct} className="flex-1 h-1.5 bg-white/20 [&>div]:bg-white" />
                          <span className="text-xs text-white/70 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="max-h-[50vh] overflow-y-auto p-3 bg-gray-50">
                        <div className="grid grid-cols-3 gap-2">
                          {galUploadItems.map(item => (
                            <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted ring-1 ring-muted">
                              <img src={item.preview} alt="" className="w-full h-full object-cover" />
                              <div className={`absolute inset-0 flex flex-col items-center justify-center ${
                                item.status === "uploading" ? "bg-black/20" : item.status === "done" ? "bg-green-600/60" : item.status === "duplicate" ? "bg-amber-500/75" : item.status === "error" ? "bg-red-500/70" : "bg-black/25"
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
                      <div className="px-4 py-3 border-t bg-white flex justify-between items-center gap-3">
                        <p className="text-xs text-muted-foreground">
                          {canClose ? "All photos saved to Connectagrapher" : "Saving photos to Connectagrapher…"}
                        </p>
                        <Button size="sm" onClick={closeGalUploadPanel} disabled={!canClose}>
                          {canClose ? "Done" : <><Loader2 className="w-3 h-3 animate-spin mr-1" />Uploading</>}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                );
              })()}

              {/* Preview dialog */}
              <Dialog open={!!galPreview} onOpenChange={open => !open && setGalPreview(null)}>
                <DialogContent className="max-w-4xl p-2 bg-black/95 border-0">
                  <img src={galPreview || ""} alt="" className="w-full h-auto max-h-[85vh] object-contain rounded" />
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* ── PRICING ── */}
          {activeTab === "pricing" && (
            <div className="max-w-3xl space-y-5">
              {/* Quick stats */}
              {(() => {
                try {
                  const config = JSON.parse(pricingRaw) as PricingConfig;
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Photoshoot Bronze", value: `$${config.packages.photoshoot.photography.bronze.price}` },
                        { label: "Photoshoot Platinum", value: `$${config.packages.photoshoot.photography.platinum.price}` },
                        { label: "Wedding Bronze", value: `$${config.packages.wedding.photography.bronze}` },
                        { label: "Wedding Platinum", value: `$${config.packages.wedding.photography.platinum}` },
                      ].map(({ label, value }) => (
                        <Card key={label}>
                          <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-primary">{value}</p>
                            <p className="text-xs text-muted-foreground mt-1">{label}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                } catch { return null; }
              })()}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pricing Configuration (JSON)</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Edit your packages, add-ons, and fees. Changes apply to new bookings immediately after saving.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                    <p className="font-semibold mb-1">Pricing Structure:</p>
                    <p>• <strong>photoshoot</strong>: price, duration (min), images, locations per tier</p>
                    <p>• <strong>wedding</strong>: simple price value per tier</p>
                    <p>• <strong>event</strong>: base rate per hour + minimum hours</p>
                    <p>• <strong>addons</strong>: drone, express delivery, highlight reel, etc.</p>
                    <p>• <strong>fees</strong>: additional person + transportation by parish</p>
                  </div>
                  <Textarea rows={22} value={pricingRaw} onChange={e => setPricingRaw(e.target.value)} className="font-mono text-xs" />
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => {
                        try {
                          const parsed = JSON.parse(pricingRaw) as PricingConfig;
                          updatePricingMutation.mutate(parsed);
                        } catch {
                          toast({ title: "Invalid JSON", description: "Fix JSON formatting before saving.", variant: "destructive" });
                        }
                      }}
                      disabled={updatePricingMutation.isPending}
                    >
                      {updatePricingMutation.isPending ? "Saving…" : "Save Pricing"}
                    </Button>
                    <Button variant="outline" onClick={() => { setPricingRaw(JSON.stringify(defaultPricingConfig, null, 2)); toast({ title: "Reset to defaults" }); }}>
                      Reset to Defaults
                    </Button>
                    <Button variant="outline" onClick={() => {
                      try { setPricingRaw(JSON.stringify(JSON.parse(pricingRaw), null, 2)); toast({ title: "Formatted" }); }
                      catch { toast({ title: "Invalid JSON", variant: "destructive" }); }
                    }}>
                      Format JSON
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── CHAT ── */}
          {activeTab === "chat" && <ChatPanel />}

        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-20 flex">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex-1 flex flex-col items-center py-2 relative text-[10px] font-medium ${
              activeTab === item.id ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="w-5 h-5 mb-0.5" />
            {item.label}
            {item.badge > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-14px)] w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </nav>

    </div>
  );
}
