import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Send, Image as ImageIcon, Loader2, ArrowLeft, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MessageWithSender } from "@shared/schema";

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
  onBack?: () => void;
  isReadOnly?: boolean;
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

export function ChatWindow({ conversationId, currentUserId, onBack, isReadOnly }: ChatWindowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    sendMutation.mutate({ msgBody: trimmed, messageType: "text" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const sigRes = await apiRequest("POST", "/api/user/upload-signature");
      const { cloudName, apiKey, signature, timestamp, folder, uploadPreset } = await sigRes.json();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      if (folder) formData.append("folder", folder);
      if (uploadPreset) formData.append("upload_preset", uploadPreset);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      const url = uploadData.secure_url;
      sendMutation.mutate({ msgBody: "📷 Image", messageType: "image", imageUrl: url });
    } catch {
      toast({ title: "Upload failed", description: "Failed to upload image.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {onBack && (
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Button size="sm" variant="ghost" onClick={onBack} className="h-7 px-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium text-sm">Back</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
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
        <div className="border-t px-4 py-3 flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
          />
          <Button
            size="icon"
            variant="ghost"
            className="shrink-0 h-9 w-9"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage || sendMutation.isPending}
            type="button"
          >
            {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
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
      )}

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={open => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-3xl p-2">
          {lightboxUrl && <img src={lightboxUrl} alt="full size" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
