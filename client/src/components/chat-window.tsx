import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Send, Loader2, ArrowLeft, Eye,
  Paperclip, Users, GalleryHorizontal as GalleryIcon, X, Share2, MapPin, MoreHorizontal,
  Mic, Square, Film, FileText, Copy, Reply, Trash2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { UserProfileSheet } from "./user-profile-sheet";
import type { MessageWithSender } from "@shared/schema";

interface Participant {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
  profileImageUrl?: string | null;
}

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  onBack?: () => void;
  isReadOnly?: boolean;
  conversationTitle?: string;
  conversationType?: string;
  participants?: Participant[];
  canShareGallery?: boolean;
  onShareGallery?: () => void;
  isCurrentUserAdmin?: boolean;
  onParticipantsChanged?: () => void;
  // New share action props
  canSendBookingCard?: boolean;
  canSendPaymentRequest?: boolean;
  canSendReviewRequest?: boolean;
  onSendBookingCard?: () => void;
  onSendPaymentRequest?: () => void;
  onSendReviewRequest?: () => void;
}

function formatTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function getSenderName(msg: MessageWithSender): string {
  if (!msg.sender) return "System";
  const name = `${msg.sender.firstName ?? ""} ${msg.sender.lastName ?? ""}`.trim();
  return name || "User";
}

function getInitials(msg: MessageWithSender): string {
  const name = getSenderName(msg);
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function participantName(p: Participant): string {
  return `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "User";
}

function participantInitials(p: Participant): string {
  const name = participantName(p);
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

function AddMemberSection({
  conversationId,
  participants,
  onAdded,
}: {
  conversationId: string;
  participants?: Participant[];
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: allUsers = [] } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const existingIds = new Set(participants?.map(p => p.id) ?? []);
  const filtered = allUsers.filter(u => {
    if (existingIds.has(u.id)) return false;
    if (!search) return false;
    const full = `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.email ?? ""}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  const addUser = async (userId: string) => {
    setAdding(true);
    try {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/participants`, { userId });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Member added" });
      setSearch("");
      onAdded();
    } catch {
      toast({ title: "Failed to add member", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Add Member</p>
      <Input
        placeholder="Search users…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-7 text-xs"
      />
      {filtered.length > 0 && (
        <div className="border rounded-md divide-y max-h-28 overflow-y-auto">
          {filtered.map(u => (
            <button
              key={u.id}
              disabled={adding}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
              onClick={() => addUser(u.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
              </div>
              <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded shrink-0">{u.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Widget: Booking Card ──────────────────────────────────────────────────────
function BookingCardWidget({ msg, currentUserId, onPayBalance }: {
  msg: MessageWithSender;
  currentUserId: string;
  onPayBalance: (bookingId: string, balanceDue: number) => void;
}) {
  let data: any = null;
  try { data = JSON.parse(msg.body); } catch { /* ignore */ }
  if (!data) return <p className="text-sm">Booking Card</p>;

  const isMe = msg.senderId === currentUserId;
  const statusColor = data.status === "completed" ? "bg-green-100 text-green-800"
    : data.status === "confirmed" ? "bg-blue-100 text-blue-800"
    : "bg-yellow-100 text-yellow-800";

  return (
    <div className="rounded-xl border w-[240px] bg-background shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b flex items-center justify-between gap-2">
        <span className="text-xs font-semibold truncate">📋 Booking Details</span>
        <Badge variant="outline" className={`text-[9px] capitalize shrink-0 ${statusColor}`}>{data.status}</Badge>
      </div>
      <div className="p-3 space-y-1.5 text-xs">
        <p className="font-medium">{data.clientName}</p>
        <p className="text-muted-foreground capitalize">{data.serviceType} – {data.packageType}</p>
        <p className="text-muted-foreground">{data.shootDate} {data.shootTime}</p>
        {data.location && <p className="text-muted-foreground">{data.location}, {data.parish}</p>}
        <div className="pt-1.5 border-t space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium">${data.totalPrice?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deposit</span>
            <span className={data.depositPaid ? "text-green-600" : "text-orange-500"}>
              {data.depositPaid ? "Paid" : "Pending"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Balance</span>
            <span className={data.balancePaid ? "text-green-600" : "text-orange-500"}>
              {data.balancePaid ? "Paid" : `$${data.balanceDue?.toLocaleString() ?? 0}`}
            </span>
          </div>
        </div>
        {!data.balancePaid && data.balanceDue > 0 && !isMe && (
          <button
            onClick={() => onPayBalance(data.bookingId, data.balanceDue)}
            className="mt-1 w-full text-center bg-primary text-primary-foreground text-xs rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors"
          >
            Pay Balance: ${data.balanceDue?.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Widget: Review Request ────────────────────────────────────────────────────
function ReviewRequestWidget({ msg, currentUserId }: {
  msg: MessageWithSender;
  currentUserId: string;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  let data: any = null;
  try { data = JSON.parse(msg.body); } catch { /* ignore */ }

  const isClient = !user?.isAdmin && user?.role !== "photographer";

  if (!isClient) {
    return (
      <div className="rounded-xl border w-[240px] bg-background shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-muted/40 border-b">
          <span className="text-xs font-semibold">⭐ Review Requested</span>
        </div>
        <div className="p-3">
          <p className="text-xs text-muted-foreground">{data?.title ?? "Waiting for client review"}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-xl border w-[240px] bg-background shadow-sm p-4 text-center">
        <p className="text-sm font-medium">Thank you for your review! ⭐</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (stars === 0 || !text.trim()) {
      toast({ title: "Please add a rating and review text", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/reviews", {
        rating: stars,
        reviewText: text.trim(),
        clientName: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Client",
        clientEmail: user?.email ?? "",
        reviewType: "general",
        bookingId: data?.bookingId,
      });
      if (!res.ok) throw new Error("Failed");
      setSubmitted(true);
    } catch {
      toast({ title: "Failed to submit review", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border w-[240px] bg-background shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b">
        <span className="text-xs font-semibold">⭐ Leave a Review</span>
      </div>
      <div className="p-3 space-y-2">
        {data?.title && <p className="text-xs text-muted-foreground">{data.title}</p>}
        {/* Star selector */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setStars(n)}
              className={`text-lg leading-none ${n <= stars ? "text-yellow-400" : "text-muted-foreground/30"}`}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Share your experience…"
          rows={3}
          className="w-full text-xs border rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground text-xs rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
      </div>
    </div>
  );
}

// ── Widget: Payment Request ───────────────────────────────────────────────────
function PaymentRequestWidget({ msg, currentUserId }: {
  msg: MessageWithSender;
  currentUserId: string;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(false);

  let data: any = null;
  try { data = JSON.parse(msg.body); } catch { /* ignore */ }
  if (!data) return <p className="text-sm">Payment Request</p>;

  const isClient = !user?.isAdmin && user?.role !== "photographer";

  if (data.balancePaid) {
    return (
      <div className="rounded-xl border w-[240px] bg-background shadow-sm p-4 text-center">
        <p className="text-sm font-medium text-green-600">Payment complete ✓</p>
      </div>
    );
  }

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/create-payment-intent", {
        bookingId: data.bookingId,
        paymentType: "balance",
        tipAmount: parseFloat(tip) || 0,
      });
      if (!res.ok) throw new Error("Failed");
      const responseData = await res.json();
      if (responseData.autoMarked) {
        window.location.href = responseData.redirectUrl || `/payment-success?booking=${data.bookingId}&type=balance`;
        return;
      }
      window.location.href = responseData.checkoutUrl;
    } catch {
      toast({ title: "Failed to start payment", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border w-[240px] bg-background shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b">
        <span className="text-xs font-semibold">💳 Payment Request</span>
      </div>
      <div className="p-3 space-y-2">
        {data.title && <p className="text-xs text-muted-foreground">{data.title}</p>}
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Balance Due</span>
          <span className="font-semibold">${data.balanceDue?.toLocaleString()}</span>
        </div>
        {isClient && (
          <>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Add a tip (optional)</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tip}
                onChange={e => setTip(e.target.value)}
                placeholder="0.00"
                className="w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {data.balanceDue === 0 && (!tip || parseFloat(tip) <= 0) ? (
              <p className="text-[10px] text-muted-foreground text-center py-1">Enter a tip amount above to pay</p>
            ) : (
              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full bg-primary text-primary-foreground text-xs rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Processing…" : `Pay Now ($${(data.balanceDue + (parseFloat(tip) || 0)).toFixed(2)})`}
              </button>
            )}
          </>
        )}
        {!isClient && (
          <p className="text-xs text-muted-foreground italic">Awaiting client payment</p>
        )}
      </div>
    </div>
  );
}

// ── Widget: Location ──────────────────────────────────────────────────────────
function LocationWidget({ msg }: { msg: MessageWithSender }) {
  let data: { text?: string; lat?: number; lng?: number; label?: string } | null = null;
  try { data = JSON.parse(msg.body); } catch { /* ignore */ }
  if (!data) return <p className="text-sm">Location</p>;

  const locationText = data.text || data.label || (data.lat != null && data.lng != null ? `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}` : "");
  const mapsUrl = data.lat != null && data.lng != null
    ? `https://maps.google.com/?q=${data.lat},${data.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent(locationText)}`;

  return (
    <div className="rounded-xl border w-[220px] bg-background shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold">📍 Shoot Location</span>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-xs">{locationText}</p>
        <button
          onClick={() => window.open(mapsUrl, "_blank")}
          className="w-full text-center bg-primary text-primary-foreground text-xs rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors"
        >
          Search in Maps
        </button>
      </div>
    </div>
  );
}

// ── Widget: Voice Note ────────────────────────────────────────────────────────
function VoiceNoteWidget({ msg }: { msg: MessageWithSender }) {
  return (
    <div className="rounded-xl border w-[240px] bg-background shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-2">
        <Mic className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold">Voice Note</span>
      </div>
      <div className="p-3">
        {msg.imageUrl ? (
          <audio controls src={msg.imageUrl} className="w-full h-10" />
        ) : (
          <p className="text-xs text-muted-foreground">Audio not available</p>
        )}
      </div>
    </div>
  );
}

// ── Widget: Video ─────────────────────────────────────────────────────────────
function VideoWidget({ msg }: { msg: MessageWithSender }) {
  return (
    <div className="rounded-xl overflow-hidden border w-[260px] bg-background shadow-sm">
      {msg.imageUrl && (
        <video controls src={msg.imageUrl} className="w-full max-h-48 object-contain bg-black" />
      )}
    </div>
  );
}

// ── Widget: File ──────────────────────────────────────────────────────────────
function FileWidget({ msg }: { msg: MessageWithSender }) {
  return (
    <div className="rounded-xl border w-[220px] bg-background shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-semibold truncate">{msg.body || "File"}</span>
      </div>
      {msg.imageUrl && (
        <div className="p-3">
          <a
            href={msg.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Download file
          </a>
        </div>
      )}
    </div>
  );
}

// ── Main ChatWindow ───────────────────────────────────────────────────────────
export function ChatWindow({
  conversationId,
  currentUserId,
  onBack,
  isReadOnly,
  conversationTitle,
  conversationType,
  participants,
  canShareGallery,
  onShareGallery,
  isCurrentUserAdmin,
  onParticipantsChanged,
  canSendBookingCard,
  canSendPaymentRequest,
  canSendReviewRequest,
  onSendBookingCard,
  onSendPaymentRequest,
  onSendReviewRequest,
}: ChatWindowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [panelView, setPanelView] = useState<"none" | "members" | "attachments">("none");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState<{ text: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [audioDraft, setAudioDraft] = useState<Blob | null>(null);
  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: MessageWithSender; x: number; y: number } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const audioDraftUrl = useMemo(() => (audioDraft ? URL.createObjectURL(audioDraft) : null), [audioDraft]);

  const { data: messages = [], isLoading } = useQuery<MessageWithSender[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/conversations/${conversationId}/messages`);
      return res.json();
    },
    refetchInterval: 4000,
    enabled: !!conversationId,
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Invalidate unread count when window is open
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations"] });
  }, [conversationId, messages.length]);

  const sendMutation = useMutation({
    mutationFn: async ({ msgBody, messageType, imageUrl }: { msgBody: string; messageType: string; imageUrl?: string }) => {
      const res = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        body: msgBody,
        messageType,
        imageUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations"] });
      setBody("");
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const handleSend = () => {
    const trimmed = body.trim();
    if (!trimmed || sendMutation.isPending) return;
    const prefix = replyTo
      ? `↩ ${getSenderName(replyTo)}: "${replyTo.body.slice(0, 80)}"\n\n`
      : "";
    sendMutation.mutate({ msgBody: prefix + trimmed, messageType: "text" });
    setReplyTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const uploadToCloudinary = async (file: File | Blob, filename?: string) => {
    const sigRes = await apiRequest("POST", "/api/user/upload-signature");
    const { cloudName, apiKey, signature, timestamp, folder } = await sigRes.json();
    const formData = new FormData();
    formData.append("file", file, filename);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    if (folder) formData.append("folder", folder);
    const isVideo = file instanceof File && file.type.startsWith("video/");
    const isImage = file instanceof File && file.type.startsWith("image/");
    const endpoint = isImage
      ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      : isVideo
      ? `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`
      : `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`; // audio + raw both use video endpoint
    const res = await fetch(endpoint, { method: "POST", body: formData });
    const data = await res.json();
    if (!data.secure_url) throw new Error("Upload failed");
    return data.secure_url as string;
  };

  const handleFileUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const url = await uploadToCloudinary(file, file.name);
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (isImage) {
        sendMutation.mutate({ msgBody: "📷 Image", messageType: "image", imageUrl: url });
      } else if (isVideo) {
        sendMutation.mutate({ msgBody: "🎥 Video", messageType: "video", imageUrl: url });
      } else {
        sendMutation.mutate({ msgBody: file.name, messageType: "file", imageUrl: url });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleShareLocation = () => {
    setLocationDraft({ text: "" });
  };

  const sendLocation = () => {
    if (!locationDraft || !locationDraft.text.trim()) return;
    sendMutation.mutate({ msgBody: JSON.stringify({ text: locationDraft.text }), messageType: "location" });
    setLocationDraft(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioDraft(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch {
      toast({ title: "Microphone not available", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const sendVoiceNote = async () => {
    if (!audioDraft) return;
    setUploadingVoice(true);
    try {
      const url = await uploadToCloudinary(audioDraft, "voice-note.webm");
      sendMutation.mutate({ msgBody: "🎤 Voice note", messageType: "voice_note", imageUrl: url });
      setAudioDraft(null);
    } catch {
      toast({ title: "Failed to upload voice note", variant: "destructive" });
    } finally {
      setUploadingVoice(false);
    }
  };

  // Context menu handlers
  const openContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: MessageWithSender) => {
    let x: number, y: number;
    if ("clientX" in e) {
      x = e.clientX;
      y = e.clientY;
    } else {
      const t = (e as React.TouchEvent).touches[0];
      x = t.clientX;
      y = t.clientY;
    }
    setContextMenu({ msg, x, y });
  };

  const handleMsgContextMenu = (e: React.MouseEvent, msg: MessageWithSender) => {
    e.preventDefault();
    openContextMenu(e, msg);
  };

  const handleMsgTouchStart = (e: React.TouchEvent, msg: MessageWithSender) => {
    touchMoved.current = false;
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        setContextMenu({ msg, x: touch.clientX, y: touch.clientY });
      }
    }, 600);
  };

  const handleMsgTouchMove = () => {
    touchMoved.current = true;
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleMsgTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const copyMsg = async (msg: MessageWithSender) => {
    try { await navigator.clipboard.writeText(msg.body); toast({ title: "Copied" }); }
    catch { toast({ title: "Copy failed", variant: "destructive" }); }
    setContextMenu(null);
  };

  const replyMsg = (msg: MessageWithSender) => { setReplyTo(msg); setContextMenu(null); };

  const deleteMsg = async (msg: MessageWithSender) => {
    try {
      const res = await apiRequest("DELETE", `/api/conversations/${conversationId}/messages/${msg.id}`);
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      toast({ title: "Message deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
    setContextMenu(null);
  };

  const handlePayBalance = async (bookingId: string, balanceDue: number) => {
    try {
      const res = await apiRequest("POST", "/api/create-payment-intent", {
        bookingId,
        paymentType: "balance",
        tipAmount: 0,
      });
      if (!res.ok) throw new Error("Failed");
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } catch {
      toast({ title: "Failed to start payment", variant: "destructive" });
    }
  };

  // Group messages by date
  const grouped: { date: string; msgs: MessageWithSender[] }[] = [];
  for (const msg of messages) {
    const dateKey = msg.createdAt ? formatDate(msg.createdAt) : "Unknown";
    const last = grouped[grouped.length - 1];
    if (last?.date === dateKey) {
      last.msgs.push(msg);
    } else {
      grouped.push({ date: dateKey, msgs: [msg] });
    }
  }

  // Attachments: image + video messages
  const attachments = messages.filter(m => ["image", "video"].includes(m.messageType) && m.imageUrl);

  const showMembersButton = conversationType === "group" || conversationType === "direct" || conversationType === "booking";
  const hasShareOptions = canShareGallery || canSendBookingCard || canSendPaymentRequest || canSendReviewRequest;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0">
        {onBack && (
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{conversationTitle || "Chat"}</p>
          {participants && participants.length > 0 && (
            <p className="text-xs text-muted-foreground">{participants.length} members</p>
          )}
        </div>
        {/* Desktop: Share dropdown */}
        {hasShareOptions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="hidden sm:flex h-7 w-7 shrink-0" title="Share">
                <Share2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canShareGallery && onShareGallery && (
                <DropdownMenuItem onClick={onShareGallery}>📷 Share Gallery</DropdownMenuItem>
              )}
              {canSendBookingCard && onSendBookingCard && (
                <DropdownMenuItem onClick={onSendBookingCard}>📋 Share Booking Details</DropdownMenuItem>
              )}
              {canSendPaymentRequest && onSendPaymentRequest && (
                <DropdownMenuItem onClick={onSendPaymentRequest}>💳 Send Payment Request</DropdownMenuItem>
              )}
              {canSendReviewRequest && onSendReviewRequest && (
                <DropdownMenuItem onClick={onSendReviewRequest}>⭐ Send Review Request</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Desktop: Attachments + Members buttons */}
        <Button
          size="icon" variant="ghost"
          className="hidden sm:flex h-7 w-7 shrink-0"
          onClick={() => setPanelView(v => v === "attachments" ? "none" : "attachments")}
          title="Attachments"
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        {showMembersButton && (
          <Button
            size="icon" variant="ghost"
            className="hidden sm:flex h-7 w-7 shrink-0"
            onClick={() => setPanelView(v => v === "members" ? "none" : "members")}
            title="Members"
          >
            <Users className="w-4 h-4" />
          </Button>
        )}

        {/* Mobile: single ⋮ with everything */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="sm:hidden h-7 w-7 shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[180px]">
            <DropdownMenuItem onClick={() => setPanelView(v => v === "attachments" ? "none" : "attachments")}>
              📎 Attachments
            </DropdownMenuItem>
            {showMembersButton && (
              <DropdownMenuItem onClick={() => setPanelView(v => v === "members" ? "none" : "members")}>
                👥 Members
              </DropdownMenuItem>
            )}
            {hasShareOptions && <DropdownMenuSeparator />}
            {canShareGallery && onShareGallery && (
              <DropdownMenuItem onClick={onShareGallery}>📷 Share Gallery</DropdownMenuItem>
            )}
            {canSendBookingCard && onSendBookingCard && (
              <DropdownMenuItem onClick={onSendBookingCard}>📋 Share Booking</DropdownMenuItem>
            )}
            {canSendPaymentRequest && onSendPaymentRequest && (
              <DropdownMenuItem onClick={onSendPaymentRequest}>💳 Send Payment Request</DropdownMenuItem>
            )}
            {canSendReviewRequest && onSendReviewRequest && (
              <DropdownMenuItem onClick={onSendReviewRequest}>⭐ Request Review</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Location draft banner */}
      {locationDraft && (
        <div className="border-b px-4 py-2 bg-muted/30 flex items-center gap-2 flex-shrink-0">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <input
            autoFocus
            className="flex-1 text-xs bg-transparent outline-none"
            placeholder="Desired shoot location (e.g. Kingston, Jamaica)…"
            value={locationDraft.text}
            onChange={e => setLocationDraft({ text: e.target.value })}
            onKeyDown={e => { if (e.key === "Enter") sendLocation(); }}
          />
          <Button size="sm" className="h-6 text-xs" onClick={sendLocation} disabled={!locationDraft.text.trim()}>Send</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setLocationDraft(null)}>Cancel</Button>
        </div>
      )}

      {/* Voice note preview banner */}
      {audioDraft && audioDraftUrl && (
        <div className="border-b px-4 py-2 bg-muted/30 flex items-center gap-2 flex-shrink-0">
          <Mic className="w-4 h-4 text-primary shrink-0" />
          <audio controls src={audioDraftUrl} className="flex-1 h-8" />
          <Button size="sm" className="h-6 text-xs" onClick={sendVoiceNote} disabled={uploadingVoice}>
            {uploadingVoice ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send"}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAudioDraft(null)}>Discard</Button>
        </div>
      )}

      {/* Body: messages + optional side panel */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Messages column */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Say hello!</p>
            ) : (
              grouped.map(({ date, msgs }) => (
                <div key={date}>
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground px-2">{date}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-3">
                    {msgs.map(msg => {
                      // System message
                      if (msg.messageType === "system") {
                        return (
                          <div key={msg.id} className="flex justify-center">
                            <span className="text-xs text-muted-foreground italic bg-muted px-3 py-1 rounded-full">
                              {msg.body}
                            </span>
                          </div>
                        );
                      }

                      const isMe = msg.senderId === currentUserId;

                      // Widget messages rendered in a neutral centered container
                      if (["gallery", "booking_card", "review_request", "payment_request", "location", "voice_note", "video", "file"].includes(msg.messageType)) {
                        let widget: React.ReactNode;

                        if (msg.messageType === "gallery") {
                          let galleryData: { title: string; coverUrl: string | null; imageCount: number; accessLink: string } | null = null;
                          try { galleryData = JSON.parse(msg.body); } catch { /* ignore */ }
                          widget = galleryData ? (
                            <div className="rounded-xl overflow-hidden border w-[220px] bg-background shadow-sm">
                              {galleryData.coverUrl ? (
                                <img src={galleryData.coverUrl} alt="" className="w-full h-28 object-cover" />
                              ) : (
                                <div className="w-full h-28 bg-muted flex items-center justify-center">
                                  <GalleryIcon className="w-8 h-8 text-muted-foreground/40" />
                                </div>
                              )}
                              <div className="p-3">
                                <p className="font-semibold text-sm leading-tight">{galleryData.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{galleryData.imageCount} photos</p>
                                <a
                                  href={galleryData.accessLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 block text-center bg-primary text-primary-foreground text-xs rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors"
                                >
                                  Open Gallery →
                                </a>
                              </div>
                            </div>
                          ) : <p className="text-sm">Gallery</p>;
                        } else if (msg.messageType === "booking_card") {
                          widget = <BookingCardWidget msg={msg} currentUserId={currentUserId} onPayBalance={handlePayBalance} />;
                        } else if (msg.messageType === "review_request") {
                          widget = <ReviewRequestWidget msg={msg} currentUserId={currentUserId} />;
                        } else if (msg.messageType === "payment_request") {
                          widget = <PaymentRequestWidget msg={msg} currentUserId={currentUserId} />;
                        } else if (msg.messageType === "location") {
                          widget = <LocationWidget msg={msg} />;
                        } else if (msg.messageType === "voice_note") {
                          widget = <VoiceNoteWidget msg={msg} />;
                        } else if (msg.messageType === "video") {
                          widget = <VideoWidget msg={msg} />;
                        } else {
                          widget = <FileWidget msg={msg} />;
                        }

                        return (
                          <div
                            key={msg.id}
                            className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                            onContextMenu={e => handleMsgContextMenu(e, msg)}
                            onTouchStart={e => handleMsgTouchStart(e, msg)}
                            onTouchMove={handleMsgTouchMove}
                            onTouchEnd={handleMsgTouchEnd}
                          >
                            {!isMe && (
                              <Avatar className="w-7 h-7 shrink-0">
                                <AvatarImage src={msg.sender?.profileImageUrl ?? undefined} />
                                <AvatarFallback className="text-[10px]">{getInitials(msg)}</AvatarFallback>
                              </Avatar>
                            )}
                            <div className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                              {!isMe && (
                                <span className="text-[11px] text-muted-foreground px-1">{getSenderName(msg)}</span>
                              )}
                              {widget}
                              <span className="text-[10px] text-muted-foreground px-1">
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Default text / image message
                      return (
                        <div
                          key={msg.id}
                          className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                          onContextMenu={e => handleMsgContextMenu(e, msg)}
                          onTouchStart={e => handleMsgTouchStart(e, msg)}
                          onTouchMove={handleMsgTouchMove}
                          onTouchEnd={handleMsgTouchEnd}
                        >
                          {!isMe && (
                            <Avatar className="w-7 h-7 shrink-0">
                              <AvatarImage src={msg.sender?.profileImageUrl ?? undefined} />
                              <AvatarFallback className="text-[10px]">{getInitials(msg)}</AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                            {!isMe && (
                              <span className="text-[11px] text-muted-foreground px-1">{getSenderName(msg)}</span>
                            )}
                            <div
                              className={`rounded-2xl px-3 py-2 text-sm ${
                                isMe
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-muted rounded-bl-sm"
                              }`}
                            >
                              {msg.messageType === "image" && msg.imageUrl ? (
                                <img
                                  src={msg.imageUrl}
                                  alt="shared image"
                                  className="rounded max-w-[200px] cursor-pointer"
                                  onClick={() => setLightboxUrl(msg.imageUrl!)}
                                />
                              ) : (
                                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground px-1">
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer or Read-Only banner */}
          {isReadOnly ? (
            <div className="border-t px-4 py-3 flex items-center justify-center gap-2 bg-muted/30">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground italic">View only – supervision mode</span>
            </div>
          ) : (
            <div className="flex-shrink-0">
            {/* Reply banner */}
            {replyTo && (
              <div className="border-t px-3 py-1.5 bg-muted/40 flex items-start gap-2">
                <Reply className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-primary">{getSenderName(replyTo)}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{replyTo.body.slice(0, 80)}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => setReplyTo(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
            <div className="border-t px-4 py-3 flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
              {/* Image/file picker */}
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 h-9 w-9"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage || uploadingVoice || sendMutation.isPending}
                title="Attach image, video, or file"
                type="button"
              >
                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </Button>
              {/* Location */}
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 h-9 w-9"
                onClick={handleShareLocation}
                title="Share shoot location"
                type="button"
              >
                <MapPin className="w-4 h-4" />
              </Button>
              {/* Voice note */}
              <Button
                size="icon"
                variant={isRecording ? "destructive" : "ghost"}
                className="shrink-0 h-9 w-9"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={uploadingVoice || uploadingImage || sendMutation.isPending}
                title={isRecording ? "Stop recording" : "Record voice note"}
                type="button"
              >
                {uploadingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                rows={1}
                className="flex-1 resize-none min-h-[36px] max-h-32 py-2"
              />
              <Button
                size="icon"
                className="shrink-0 h-9 w-9"
                onClick={handleSend}
                disabled={!body.trim() || sendMutation.isPending}
              >
                {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            </div>
          )}
        </div>

        {/* Side panel — overlays on mobile, sidebar on desktop */}
        {panelView !== "none" && (
          <div className="absolute sm:relative right-0 top-0 bottom-0 sm:top-auto sm:bottom-auto w-72 sm:w-64 bg-background border-l flex flex-col flex-shrink-0 overflow-y-auto shadow-lg sm:shadow-none z-10">
            {panelView === "members" && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Members</h3>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPanelView("none")}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                {(participants ?? []).map(p => (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-2 py-1 text-left hover:bg-muted/50 rounded px-1 transition-colors"
                    onClick={() => setProfileUserId(p.id)}
                  >
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarImage src={p.profileImageUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">{participantInitials(p)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{participantName(p)}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{p.role}</p>
                    </div>
                  </button>
                ))}
                {isCurrentUserAdmin && (
                  <AddMemberSection
                    conversationId={conversationId}
                    participants={participants}
                    onAdded={() => onParticipantsChanged?.()}
                  />
                )}
              </div>
            )}

            {panelView === "attachments" && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Attachments</h3>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPanelView("none")}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No attachments yet</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {attachments.map(m => (
                      m.messageType === "video" ? (
                        <div key={m.id} className="relative aspect-square bg-black rounded overflow-hidden cursor-pointer" onClick={() => setLightboxUrl(m.imageUrl!)}>
                          <video src={m.imageUrl!} className="w-full h-full object-cover opacity-80" />
                          <Film className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />
                        </div>
                      ) : (
                        <img
                          key={m.id}
                          src={m.imageUrl!}
                          className="aspect-square object-cover rounded cursor-pointer"
                          onClick={() => setLightboxUrl(m.imageUrl!)}
                          alt="attachment"
                        />
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={open => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxUrl && (
            lightboxUrl.match(/\.(mp4|webm|mov|avi|mkv)/i)
              ? <video controls src={lightboxUrl} className="w-full rounded max-h-[80vh]" />
              : <img src={lightboxUrl} alt="full size" className="w-full rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* User Profile Sheet */}
      <UserProfileSheet userId={profileUserId} onClose={() => setProfileUserId(null)} />

      {/* Context menu overlay */}
      {contextMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)}>
          <div
            className="absolute bg-background border rounded-xl shadow-xl overflow-hidden py-1 min-w-[160px]"
            style={{
              left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 400) - 180),
              top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 140),
            }}
            onClick={e => e.stopPropagation()}
          >
            {contextMenu.msg.messageType === "text" && (
              <button
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2"
                onClick={() => copyMsg(contextMenu.msg)}
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
            )}
            <button
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2"
              onClick={() => replyMsg(contextMenu.msg)}
            >
              <Reply className="w-4 h-4" /> Reply
            </button>
            {(contextMenu.msg.senderId === currentUserId || isCurrentUserAdmin) && (
              <button
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                onClick={() => deleteMsg(contextMenu.msg)}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
