import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageSquareIcon, MailIcon, UserIcon, Trash2, CheckCheck, Mail, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
}

interface EmailMessage {
  id: string;
  resendEmailId: string | null;
  from: string;
  to: string;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  isRead: boolean;
  status: string;
  receivedAt: string;
  threadId: string | null;
  direction: string;
  senderName: string | null;
}

interface EmailThread {
  threadId: string;
  subject: string | null;
  from: { name: string; email: string };
  status: string;
  lastActivity: string;
  messages: EmailMessage[];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const statusColor = (s: string) =>
  s === "unread" ? "bg-red-500" : s === "read" ? "bg-blue-500" : s === "responded" ? "bg-green-500" : "bg-gray-500";

// ─── Thread Card ──────────────────────────────────────────────────────────────

interface ThreadCardProps {
  thread: EmailThread;
  onReply: (thread: EmailThread) => void;
  onDelete: (threadId: string) => void;
  onStatusChange: (threadId: string, status: string) => void;
}

function ThreadCard({ thread, onReply, onDelete, onStatusChange }: ThreadCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={thread.status === "unread" ? "border-blue-200 bg-blue-50/20" : ""}>
      <CardContent className="p-5">
        {/* Thread header */}
        <div className="flex justify-between items-start gap-3 mb-3">
          <button
            className="flex-1 text-left min-w-0"
            onClick={() => setExpanded(e => !e)}
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <UserIcon className="w-4 h-4 text-gray-500 shrink-0" />
              <h3 className={`text-sm ${thread.status === "unread" ? "font-bold" : "font-semibold"}`}>
                {thread.from.name}
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-sky-50 text-sky-700 border-sky-200"
              >
                Email
              </Badge>
              <Badge className={`${statusColor(thread.status)} text-white text-[10px] px-1.5 py-0`}>
                {thread.status.toUpperCase()}
              </Badge>
              {thread.messages.length > 1 && (
                <span className="text-xs text-muted-foreground">↳ {thread.messages.length} messages</span>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <MailIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <a
                href={`mailto:${thread.from.email}`}
                className="text-sm text-blue-600 hover:underline truncate"
                onClick={e => e.stopPropagation()}
              >
                {thread.from.email}
              </a>
            </div>
            {thread.subject && (
              <p className="text-sm font-medium text-gray-800 truncate">{thread.subject}</p>
            )}
            {!expanded && thread.messages[0]?.textBody && (
              <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{thread.messages[0].textBody}</p>
            )}
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(thread.lastActivity)}</span>
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded messages */}
        {expanded && (
          <div className="space-y-3 mb-3 border-t pt-3">
            {thread.messages.map(msg => (
              <div
                key={msg.id}
                className={`rounded-lg p-3 text-sm ${
                  msg.direction === "outbound"
                    ? "bg-primary/5 border border-primary/20 ml-6"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="font-medium text-xs text-muted-foreground">
                    {msg.direction === "outbound" ? "You (Admin)" : (msg.senderName || thread.from.name)}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDate(msg.receivedAt)}
                  </span>
                </div>
                {msg.htmlBody ? (
                  <div
                    className="prose prose-sm max-w-none overflow-auto"
                    dangerouslySetInnerHTML={{ __html: msg.htmlBody }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-gray-700">{msg.textBody || "(no body)"}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={() => onReply(thread)}>
            <Mail className="w-3.5 h-3.5 mr-1.5" /> Reply
          </Button>
          {thread.status !== "responded" && (
            <Button
              size="sm" variant="outline"
              onClick={() => onStatusChange(thread.threadId, thread.status === "unread" ? "read" : "unread")}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              {thread.status === "unread" ? "Mark Read" : "Mark Unread"}
            </Button>
          )}
          {thread.status === "read" && (
            <Button
              size="sm" variant="outline"
              className="text-green-700 border-green-200 hover:bg-green-50"
              onClick={() => onStatusChange(thread.threadId, "responded")}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Mark Responded
            </Button>
          )}
          <Button
            size="sm" variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
            onClick={() => onDelete(thread.threadId)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminContacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [replyThread, setReplyThread] = useState<EmailThread | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);

  const { data: contacts, isLoading: loadingContacts } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contacts"],
    retry: false,
  });

  const { data: emailThreads, isLoading: loadingThreads } = useQuery<EmailThread[]>({
    queryKey: ["/api/admin/email-threads"],
    retry: false,
  });

  const isLoading = loadingContacts || loadingThreads;

  const threadList = Array.isArray(emailThreads) ? emailThreads : [];
  const contactList = Array.isArray(contacts) ? contacts : [];

  // Update status for a thread (marks the root email)
  const updateThreadStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/inbound-emails/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/email-threads"] }),
  });

  const updateContactStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/contacts/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] }),
  });

  // Delete thread: delete all messages whose threadId matches
  const deleteThread = useMutation({
    mutationFn: async (threadId: string) => {
      const thread = threadList.find(t => t.threadId === threadId);
      if (!thread) return;
      await Promise.all(thread.messages.map(m => apiRequest("DELETE", `/api/admin/inbound-emails/${m.id}`, {})));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-threads"] });
      setDeleteThreadId(null);
      toast({ title: "Thread deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/contacts/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      toast({ title: "Message deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  // Reply
  const sendReply = useMutation({
    mutationFn: (data: { email: string; clientName: string; subject: string; message: string; threadId?: string }) =>
      apiRequest("POST", "/api/admin/send-email", data),
    onSuccess: () => {
      toast({ title: "Reply sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-threads"] });
      setReplyThread(null);
      setReplySubject("");
      setReplyMessage("");
    },
    onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
  });

  const openReply = (thread: EmailThread) => {
    setReplyThread(thread);
    setReplySubject(thread.subject ? `Re: ${thread.subject}` : `Re: Message from ${thread.from.name}`);
    setReplyMessage("");
    // Mark as read if unread
    if (thread.status === "unread") {
      updateThreadStatus.mutate({ id: thread.threadId, status: "read" });
    }
  };

  // Filter threads
  const filteredThreads = useMemo(() => {
    return threadList.filter(t => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !t.from.name.toLowerCase().includes(s) &&
          !t.from.email.toLowerCase().includes(s) &&
          !(t.subject || "").toLowerCase().includes(s) &&
          !t.messages.some(m => (m.textBody || "").toLowerCase().includes(s))
        ) return false;
      }
      return true;
    });
  }, [threadList, statusFilter, search]);

  const filteredContacts = useMemo(() => {
    return contactList.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !c.name.toLowerCase().includes(s) &&
          !c.email.toLowerCase().includes(s) &&
          !c.message.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [contactList, statusFilter, search]);

  const unreadThreads = threadList.filter(t => t.status === "unread").length;
  const unreadContacts = contactList.filter(c => c.status === "unread").length;
  const totalUnread = unreadThreads + unreadContacts;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareIcon className="w-5 h-5" />
            Messages
            {totalUnread > 0 && (
              <Badge className="bg-red-500 text-white text-xs ml-1">{totalUnread} unread</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Contact form submissions and inbound email threads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search name, email, subject, message…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger><SelectValue placeholder="All Sources" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="contact">Contact Form ({contactList.length})</SelectItem>
                  <SelectItem value="email">Email Threads ({threadList.length})</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {filteredThreads.length + filteredContacts.length} messages shown
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => { setSearch(""); setSourceFilter("all"); setStatusFilter("all"); }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Email Threads Section */}
          {sourceFilter !== "contact" && (
            <div className="mb-6">
              {filteredThreads.length > 0 && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Email Threads ({filteredThreads.length})
                </h3>
              )}
              <div className="grid gap-4">
                {filteredThreads.map(thread => (
                  <ThreadCard
                    key={thread.threadId}
                    thread={thread}
                    onReply={openReply}
                    onDelete={id => setDeleteThreadId(id)}
                    onStatusChange={(id, status) => updateThreadStatus.mutate({ id, status })}
                  />
                ))}
                {filteredThreads.length === 0 && sourceFilter === "email" && (
                  <div className="text-center py-6 text-gray-500 text-sm">No email threads found.</div>
                )}
              </div>
            </div>
          )}

          {/* Contact Form Section */}
          {sourceFilter !== "email" && (
            <div>
              {filteredContacts.length > 0 && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Contact Form ({filteredContacts.length})
                </h3>
              )}
              <div className="grid gap-4">
                {filteredContacts.map(c => (
                  <Card key={c.id} className={c.status === "unread" ? "border-blue-200 bg-blue-50/20" : ""}>
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <UserIcon className="w-4 h-4 text-gray-500 shrink-0" />
                            <h3 className={`text-sm ${c.status === "unread" ? "font-bold" : "font-semibold"}`}>{c.name}</h3>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200">
                              Contact Form
                            </Badge>
                            <Badge className={`${statusColor(c.status)} text-white text-[10px] px-1.5 py-0`}>
                              {c.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <MailIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <a href={`mailto:${c.email}`} className="text-sm text-blue-600 hover:underline truncate">{c.email}</a>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{c.message}</p>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{formatDate(c.createdAt)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-3 border-t">
                        {c.status !== "responded" && (
                          <Button
                            size="sm" variant="outline"
                            onClick={() => updateContactStatus.mutate({ id: c.id, status: c.status === "unread" ? "read" : "unread" })}
                          >
                            <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                            {c.status === "unread" ? "Mark Read" : "Mark Unread"}
                          </Button>
                        )}
                        {c.status === "read" && (
                          <Button
                            size="sm" variant="outline"
                            className="text-green-700 border-green-200 hover:bg-green-50"
                            onClick={() => updateContactStatus.mutate({ id: c.id, status: "responded" })}
                          >
                            <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Mark Responded
                          </Button>
                        )}
                        <Button
                          size="sm" variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                          onClick={() => deleteContact.mutate(c.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredContacts.length === 0 && sourceFilter === "contact" && (
                  <div className="text-center py-6 text-gray-500 text-sm">No contact form submissions found.</div>
                )}
              </div>
            </div>
          )}

          {filteredThreads.length === 0 && filteredContacts.length === 0 && sourceFilter === "all" && (
            <div className="text-center py-8 text-gray-500">
              {threadList.length === 0 && contactList.length === 0 ? "No messages yet." : "No messages match your filters."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply Dialog */}
      <Dialog open={!!replyThread} onOpenChange={(open) => !open && setReplyThread(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {replyThread?.from.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>To</Label>
              <p className="text-sm text-muted-foreground mt-1">{replyThread?.from.email}</p>
            </div>
            <div>
              <Label htmlFor="reply-subject">Subject</Label>
              <Input
                id="reply-subject"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="reply-message">Message</Label>
              <Textarea
                id="reply-message"
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={6}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyThread(null)}>Cancel</Button>
            <Button
              disabled={!replySubject || !replyMessage || sendReply.isPending}
              onClick={() => {
                if (!replyThread) return;
                sendReply.mutate({
                  email: replyThread.from.email,
                  clientName: replyThread.from.name,
                  subject: replySubject,
                  message: replyMessage,
                  threadId: replyThread.threadId,
                });
              }}
            >
              {sendReply.isPending ? "Sending…" : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteThreadId} onOpenChange={(open) => !open && setDeleteThreadId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Thread</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Delete this entire email thread? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteThreadId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteThread.isPending}
              onClick={() => deleteThreadId && deleteThread.mutate(deleteThreadId)}
            >
              {deleteThread.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
