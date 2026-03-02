import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ConversationWithMeta } from "@shared/schema";

interface ConversationListProps {
  conversations: ConversationWithMeta[];
  selectedId?: string;
  currentUserId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}

function formatTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getConversationTitle(conv: ConversationWithMeta, currentUserId: string): string {
  if (conv.title) return conv.title;
  const others = conv.participants.filter(p => p.id !== currentUserId);
  if (others.length === 0) return "Conversation";
  return others.map(p => `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.email || "User").join(", ");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function sortConversations(convs: ConversationWithMeta[]): ConversationWithMeta[] {
  return [...convs].sort((a, b) => {
    // Support conversations pinned to top
    if (a.type === "support" && b.type !== "support") return -1;
    if (b.type === "support" && a.type !== "support") return 1;
    // Then sort by updatedAt descending
    return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
  });
}

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  onSelect,
  loading,
}: ConversationListProps) {
  const sorted = sortConversations(conversations);

  return (
    <div className="flex flex-col h-full border-r">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-sm">Messages</h2>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading...
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground px-4 text-center">
          <MessageSquare className="w-8 h-8 opacity-30" />
          <p className="text-sm">No conversations yet</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {sorted.map(conv => {
            const title = getConversationTitle(conv, currentUserId);
            const preview = conv.lastMessage?.body ?? "";
            const truncated = preview.length > 60 ? preview.slice(0, 60) + "…" : preview;
            const isSelected = conv.id === selectedId;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0 ${
                  isSelected ? "bg-muted" : ""
                }`}
              >
                <Avatar className="w-9 h-9 shrink-0 mt-0.5">
                  <AvatarFallback className="text-xs">{getInitials(title)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-medium text-sm truncate">{title}</span>
                      {conv.type === "support" && (
                        <Badge className="bg-green-500 text-white text-[9px] px-1.5 py-0 h-4 shrink-0">Support</Badge>
                      )}
                      {conv.type === "booking" && (
                        <Badge className="bg-blue-500 text-white text-[9px] px-1.5 py-0 h-4 shrink-0">Booking</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTime(conv.lastMessage?.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-xs text-muted-foreground truncate">{truncated || "No messages yet"}</span>
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-4 shrink-0">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
