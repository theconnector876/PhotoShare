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
import { MessageSquareIcon, MailIcon, UserIcon, Trash2, CheckCheck, Mail, Eye } from "lucide-react";
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

interface InboundEmail {
  id: string;
  from: string;
  to: string;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  isRead: boolean;
  status: string;
  receivedAt: string;
}

type Source = "contact" | "inbound";

interface UnifiedMessage {
  id: string;
  source: Source;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  htmlBody?: string | null;
  status: string;
  date: string;
}

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    const name = match[1].trim();
    const email = match[2].trim();
    return { name: name || email, email };
  }
  return { name: from, email: from };
}

export function AdminContacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [replyTarget, setReplyTarget] = useState<UnifiedMessage | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [viewTarget, setViewTarget] = useState<UnifiedMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UnifiedMessage | null>(null);

  const { data: contacts, isLoading: loadingContacts } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contacts"],
    retry: false,
  });

  const { data: inboundEmails, isLoading: loadingInbound } = useQuery<InboundEmail[]>({
    queryKey: ["/api/admin/inbound-emails"],
    retry: false,
  });

  const isLoading = loadingContacts || loadingInbound;

  const allMessages = useMemo<UnifiedMessage[]>(() => {
    const contactItems: UnifiedMessage[] = (Array.isArray(contacts) ? contacts : []).map((c) => ({
      id: c.id,
      source: "contact",
      name: c.name,
      email: c.email,
      subject: null,
      body: c.message,
      status: c.status || "unread",
      date: c.createdAt,
    }));

    const inboundItems: UnifiedMessage[] = (Array.isArray(inboundEmails) ? inboundEmails : []).map((e) => {
      const { name, email } = parseFrom(e.from);
      return {
        id: e.id,
        source: "inbound",
        name,
        email,
        subject: e.subject,
        body: e.textBody || "",
        htmlBody: e.htmlBody,
        status: e.status || (e.isRead ? "read" : "unread"),
        date: e.receivedAt,
      };
    });

    return [...contactItems, ...inboundItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [contacts, inboundEmails]);

  // Status mutations
  const updateContactStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/contacts/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] }),
  });

  const updateInboundStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/inbound-emails/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/inbound-emails"] }),
  });

  const updateStatus = (msg: UnifiedMessage, status: string) => {
    if (msg.source === "contact") updateContactStatus.mutate({ id: msg.id, status });
    else updateInboundStatus.mutate({ id: msg.id, status });
  };

  // Delete mutations
  const deleteContact = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/contacts/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      setDeleteTarget(null);
      toast({ title: "Message deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const deleteInbound = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/inbound-emails/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbound-emails"] });
      setDeleteTarget(null);
      toast({ title: "Email deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const handleDelete = (msg: UnifiedMessage) => {
    if (msg.source === "contact") deleteContact.mutate(msg.id);
    else deleteInbound.mutate(msg.id);
  };

  // Reply mutation
  const sendReply = useMutation({
    mutationFn: (data: { email: string; clientName: string; subject: string; message: string }) =>
      apiRequest("POST", "/api/admin/send-email", data),
    onSuccess: () => {
      if (replyTarget) updateStatus(replyTarget, "responded");
      toast({ title: "Reply sent" });
      setReplyTarget(null);
      setReplySubject("");
      setReplyMessage("");
    },
    onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
  });

  const openReply = (msg: UnifiedMessage) => {
    setReplyTarget(msg);
    setReplySubject(
      msg.source === "inbound" && msg.subject ? `Re: ${msg.subject}` : `Re: Message from ${msg.name}`
    );
    setReplyMessage("");
    if (msg.status === "unread") updateStatus(msg, "read");
  };

  const openView = (msg: UnifiedMessage) => {
    setViewTarget(msg);
    if (msg.status === "unread") updateStatus(msg, "read");
  };

  // Counts for filter labels
  const contactCount = (Array.isArray(contacts) ? contacts : []).length;
  const inboundCount = (Array.isArray(inboundEmails) ? inboundEmails : []).length;
  const unreadCount = allMessages.filter((m) => m.status === "unread").length;

  const filtered = allMessages.filter((msg) => {
    if (sourceFilter !== "all" && msg.source !== sourceFilter) return false;
    if (statusFilter !== "all" && msg.status !== statusFilter) return false;
    if (dateFilter === "today" && new Date().toDateString() !== new Date(msg.date).toDateString()) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !msg.name.toLowerCase().includes(s) &&
        !msg.email.toLowerCase().includes(s) &&
        !msg.body.toLowerCase().includes(s) &&
        !(msg.subject || "").toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const statusColor = (s: string) =>
    s === "unread" ? "bg-red-500" : s === "read" ? "bg-blue-500" : s === "responded" ? "bg-green-500" : "bg-gray-500";

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
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs ml-1">{unreadCount} unread</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Contact form submissions and inbound emails in one place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                  <SelectItem value="all">All Sources ({allMessages.length})</SelectItem>
                  <SelectItem value="contact">Contact Form ({contactCount})</SelectItem>
                  <SelectItem value="inbound">Inbound Email ({inboundCount})</SelectItem>
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
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger><SelectValue placeholder="All Dates" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Showing {filtered.length} of {allMessages.length} messages
              </span>
              <Button
                variant="outline" size="sm"
                onClick={() => { setSearch(""); setSourceFilter("all"); setStatusFilter("all"); setDateFilter("all"); }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {allMessages.length === 0 ? "No messages yet." : "No messages match your filters."}
              </div>
            ) : (
              filtered.map((msg) => (
                <Card
                  key={`${msg.source}-${msg.id}`}
                  className={msg.status === "unread" ? "border-blue-200 bg-blue-50/20" : ""}
                >
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <UserIcon className="w-4 h-4 text-gray-500 shrink-0" />
                          <h3 className={`text-sm ${msg.status === "unread" ? "font-bold" : "font-semibold"}`}>
                            {msg.name}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              msg.source === "contact"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-sky-50 text-sky-700 border-sky-200"
                            }`}
                          >
                            {msg.source === "contact" ? "Contact Form" : "Email"}
                          </Badge>
                          <Badge className={`${statusColor(msg.status)} text-white text-[10px] px-1.5 py-0`}>
                            {msg.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <MailIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <a href={`mailto:${msg.email}`} className="text-sm text-blue-600 hover:underline truncate">
                            {msg.email}
                          </a>
                        </div>
                        {msg.subject && (
                          <p className="text-sm font-medium text-gray-800 mb-1 truncate">{msg.subject}</p>
                        )}
                        <p className="text-sm text-gray-600 line-clamp-2">{msg.body || "(no body)"}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                        {formatDate(msg.date)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-3 border-t">
                      {msg.source === "inbound" && (
                        <Button size="sm" variant="outline" onClick={() => openView(msg)}>
                          <Eye className="w-3.5 h-3.5 mr-1.5" /> View
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openReply(msg)}>
                        <Mail className="w-3.5 h-3.5 mr-1.5" /> Reply
                      </Button>
                      {msg.status !== "responded" && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => updateStatus(msg, msg.status === "unread" ? "read" : "unread")}
                        >
                          <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                          {msg.status === "unread" ? "Mark Read" : "Mark Unread"}
                        </Button>
                      )}
                      {msg.status === "read" && (
                        <Button
                          size="sm" variant="outline"
                          className="text-green-700 border-green-200 hover:bg-green-50"
                          onClick={() => updateStatus(msg, "responded")}
                        >
                          <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Mark Responded
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                        onClick={() => setDeleteTarget(msg)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Email Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewTarget?.subject || `Message from ${viewTarget?.name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-gray-50 rounded p-3 space-y-1">
              <p><span className="font-medium">From:</span> {viewTarget?.name} &lt;{viewTarget?.email}&gt;</p>
              {viewTarget?.date && (
                <p><span className="font-medium">Received:</span> {formatDate(viewTarget.date)}</p>
              )}
            </div>
            {viewTarget?.htmlBody ? (
              <div
                className="border rounded p-3 prose prose-sm max-w-none overflow-auto"
                dangerouslySetInnerHTML={{ __html: viewTarget.htmlBody }}
              />
            ) : (
              <div className="border rounded p-3 whitespace-pre-wrap text-gray-700">
                {viewTarget?.body || "(no body)"}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
            <Button
              onClick={() => {
                if (viewTarget) { setViewTarget(null); openReply(viewTarget); }
              }}
            >
              <Mail className="w-3.5 h-3.5 mr-1.5" /> Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={!!replyTarget} onOpenChange={(open) => !open && setReplyTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {replyTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>To</Label>
              <p className="text-sm text-muted-foreground mt-1">{replyTarget?.email}</p>
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
            <Button variant="outline" onClick={() => setReplyTarget(null)}>Cancel</Button>
            <Button
              disabled={!replySubject || !replyMessage || sendReply.isPending}
              onClick={() => {
                if (!replyTarget) return;
                sendReply.mutate({
                  email: replyTarget.email,
                  clientName: replyTarget.name,
                  subject: replySubject,
                  message: replyMessage,
                });
              }}
            >
              {sendReply.isPending ? "Sending…" : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Delete the message from <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteContact.isPending || deleteInbound.isPending}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleteContact.isPending || deleteInbound.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
