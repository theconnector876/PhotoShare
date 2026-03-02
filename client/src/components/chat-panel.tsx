import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { MessageSquare, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ConversationWithMeta } from "@shared/schema";

interface ChatPanelProps {
  isAdmin?: boolean;
}

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isAdmin: boolean;
}

interface AdminNewChatModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
  currentUserId: string;
}

function AdminNewChatModal({ open, onClose, onCreated, currentUserId }: AdminNewChatModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");

  const { data: allUsers = [] } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    enabled: open,
  });

  const selectable = allUsers
    .filter(u => u.id !== currentUserId)
    .filter(u => {
      if (!search) return true;
      const full = `${u.firstName ?? ""} ${u.lastName ?? ""} ${u.email ?? ""}`.toLowerCase();
      return full.includes(search.toLowerCase());
    });

  const isGroup = selectedIds.length > 1;

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/conversations", {
        userIds: selectedIds,
        title: isGroup ? title : undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create conversation");
      }
      return res.json();
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/conversations"] });
      onCreated(conv.id);
      handleClose();
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setSelectedIds([]);
    setTitle("");
    setSearch("");
    onClose();
  };

  const toggleUser = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const canSubmit = selectedIds.length >= 1 && (!isGroup || title.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm"
          />

          <div className="max-h-52 overflow-y-auto border rounded-md divide-y">
            {selectable.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
            )}
            {selectable.map(u => {
              const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || u.id;
              const isChecked = selectedIds.includes(u.id);
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleUser(u.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                    {u.role}
                  </span>
                </label>
              );
            })}
          </div>

          {isGroup && (
            <div>
              <Label className="text-xs">Group name (required)</Label>
              <Input
                placeholder="e.g. Wedding Team"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
          )}

          {selectedIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {isGroup
                ? `Group chat with ${selectedIds.length} participants`
                : "Direct message (1-on-1)"}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creating…" : "Start Chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChatPanel({ isAdmin }: ChatPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [showNewChat, setShowNewChat] = useState(false);

  const conversationsKey = isAdmin ? "/api/admin/conversations" : "/api/conversations";

  const { data: conversations = [], isLoading } = useQuery<ConversationWithMeta[]>({
    queryKey: [conversationsKey],
    queryFn: async () => {
      const res = await apiRequest("GET", conversationsKey);
      return res.json();
    },
    refetchInterval: 4000,
    enabled: !!user,
  });

  // For non-admin: ensure support chat exists on mount
  useEffect(() => {
    if (!user || isAdmin) return;
    apiRequest("GET", "/api/conversations/support")
      .then(() => queryClient.invalidateQueries({ queryKey: [conversationsKey] }))
      .catch(() => {});
  }, [user, isAdmin]);

  // Auto-select: prefer booking conversation first, then support (non-admin only)
  useEffect(() => {
    if (isAdmin || selectedId || conversations.length === 0) return;
    const preferred = conversations.find(c => c.type === "booking")
                   ?? conversations.find(c => c.type === "support");
    if (preferred) setSelectedId(preferred.id);
  }, [conversations, isAdmin, selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileView("chat");
  };

  const handleBack = () => {
    setMobileView("list");
  };

  const currentUserId = user?.id ?? "";
  const selectedConv = conversations.find(c => c.id === selectedId);

  if (!user) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px] border rounded-lg overflow-hidden bg-background">
      {/* Desktop: side-by-side. Mobile: single column */}
      <div className="h-full grid md:grid-cols-[280px_1fr]">
        {/* Conversation list — hidden on mobile when chat is open */}
        <div className={`h-full flex flex-col ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
          {isAdmin && (
            <div className="px-3 pt-2 pb-1 border-b border-r flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs"
                onClick={() => setShowNewChat(true)}
              >
                <Plus className="w-3 h-3 mr-1" />
                New Chat
              </Button>
            </div>
          )}
          <div className="flex-1 min-h-0">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              currentUserId={currentUserId}
              onSelect={handleSelect}
              loading={isLoading}
            />
          </div>
        </div>

        {/* Chat window */}
        <div className={`h-full ${mobileView === "list" ? "hidden md:flex" : "flex"} flex-col`}>
          {selectedId ? (
            <ChatWindow
              conversationId={selectedId}
              currentUserId={currentUserId}
              onBack={mobileView === "chat" ? handleBack : undefined}
              isReadOnly={selectedConv?.currentUserRole === 'observer'}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <AdminNewChatModal
          open={showNewChat}
          onClose={() => setShowNewChat(false)}
          onCreated={(id) => {
            setSelectedId(id);
            setMobileView("chat");
          }}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
