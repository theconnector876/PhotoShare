import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { ConversationWithMeta } from "@shared/schema";

interface ChatPanelProps {
  isAdmin?: boolean;
}

export function ChatPanel({ isAdmin }: ChatPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

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

  // Auto-select support chat when conversations load (non-admin only)
  useEffect(() => {
    if (isAdmin || selectedId || conversations.length === 0) return;
    const support = conversations.find(c => c.type === "support");
    if (support) setSelectedId(support.id);
  }, [conversations, isAdmin, selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileView("chat");
  };

  const handleBack = () => {
    setMobileView("list");
  };

  const currentUserId = user?.id ?? "";

  if (!user) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[500px] border rounded-lg overflow-hidden bg-background">
      {/* Desktop: side-by-side. Mobile: single column */}
      <div className="h-full grid md:grid-cols-[280px_1fr]">
        {/* Conversation list — hidden on mobile when chat is open */}
        <div className={`h-full ${mobileView === "chat" ? "hidden md:block" : "block"}`}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            currentUserId={currentUserId}
            onSelect={handleSelect}
            loading={isLoading}
          />
        </div>

        {/* Chat window */}
        <div className={`h-full ${mobileView === "list" ? "hidden md:flex" : "flex"} flex-col`}>
          {selectedId ? (
            <ChatWindow
              conversationId={selectedId}
              currentUserId={currentUserId}
              onBack={mobileView === "chat" ? handleBack : undefined}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="w-12 h-12 opacity-20" />
              <p className="text-sm">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
