import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { ConversationWithMeta } from "@shared/schema";

interface ChatPanelProps {
  isAdmin?: boolean;
}

export function ChatPanel({ isAdmin }: ChatPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
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

  const startChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/conversations", {
        type: "support",
        title: "Support Chat",
      });
      return res.json();
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: [conversationsKey] });
      setSelectedId(conv.id);
      setMobileView("chat");
    },
    onError: () => {
      toast({ title: "Failed to start chat", variant: "destructive" });
    },
  });

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileView("chat");
  };

  const handleBack = () => {
    setMobileView("list");
  };

  const handleNewConversation = () => {
    if (!isAdmin) {
      startChatMutation.mutate();
    }
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
            onNewConversation={!isAdmin ? handleNewConversation : undefined}
            loading={isLoading}
          />
          {!isAdmin && startChatMutation.isPending && (
            <div className="flex justify-center p-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
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
              {!isAdmin && conversations.length === 0 && (
                <Button
                  onClick={handleNewConversation}
                  disabled={startChatMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  {startChatMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting chat...</>
                  ) : (
                    "Start Support Chat"
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
