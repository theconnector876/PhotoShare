import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, Save, Lock, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export function UserProfileForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [, navigate] = useLocation();

  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: (user as any)?.phone ?? "",
    profileImageUrl: (user as any)?.profileImageUrl ?? "",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      return await apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile saved", description: "Your profile has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
    },
  });

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true);
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
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      const url = uploadData.secure_url;
      setForm(f => ({ ...f, profileImageUrl: url }));
      await apiRequest("PATCH", "/api/user/profile", { ...form, profileImageUrl: url });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Photo updated" });
    } catch {
      toast({ title: "Upload failed", description: "Failed to upload photo.", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const initials = `${form.firstName?.[0] ?? ""}${form.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  const fullName = `${form.firstName} ${form.lastName}`.trim() || "Your Name";
  const roleLabel = user?.role === "photographer" ? "Photographer" : user?.isAdmin ? "Admin" : "Client";
  const roleBadgeColor = user?.isAdmin
    ? "bg-purple-100 text-purple-700"
    : user?.role === "photographer"
    ? "bg-blue-100 text-blue-700"
    : "bg-green-100 text-green-700";

  return (
    <Card className="max-w-lg overflow-hidden">
      {/* Gradient cover strip */}
      <div className="h-24 bg-gradient-to-r from-primary/20 to-secondary/20 relative" />

      {/* Avatar overlapping the cover */}
      <div className="px-6 pb-6">
        <div className="flex items-end gap-4 -mt-12 mb-4">
          <div className="relative shrink-0">
            <Avatar className="w-24 h-24 ring-4 ring-background shadow">
              <AvatarImage src={form.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <button
              className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1.5 shadow hover:bg-primary/90"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              type="button"
            >
              {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
            />
          </div>
          <div className="mb-1 min-w-0">
            <p className="font-semibold text-lg leading-tight truncate">{fullName}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeColor}`}>{roleLabel}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>
          </div>
        </div>

        <CardContent className="p-0 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone}
              placeholder="+1 (876) 000-0000"
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>

          {/* Email — read-only */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              <Lock className="w-3 h-3" /> Email
            </Label>
            <Input value={user?.email ?? ""} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
          </div>

          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save Profile</>
            )}
          </Button>

          {/* Account Deletion — required by Apple App Store */}
          <div className="pt-4 border-t mt-4">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Delete my account
              </button>
            ) : (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-destructive">Delete account?</p>
                <p className="text-xs text-muted-foreground">
                  This permanently removes your account, profile, and all associated data. Bookings
                  may be retained for legal compliance. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deletingAccount}
                    onClick={async () => {
                      setDeletingAccount(true);
                      try {
                        const res = await apiRequest("DELETE", "/api/user/account");
                        if (!res.ok) throw new Error();
                        queryClient.clear();
                        navigate("/");
                        toast({ title: "Account deleted", description: "Your account has been removed." });
                      } catch {
                        toast({ title: "Error", description: "Failed to delete account. Contact support.", variant: "destructive" });
                        setDeletingAccount(false);
                      }
                    }}
                  >
                    {deletingAccount ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                    Yes, delete permanently
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
