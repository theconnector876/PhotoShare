import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageSquareIcon, MailIcon, UserIcon, Trash2, CheckCheck, Mail } from "lucide-react";
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

export function AdminContacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [replyContact, setReplyContact] = useState<ContactMessage | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);

  const { data: contacts, isLoading } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contacts"],
    retry: false,
  });

  const safeContacts = Array.isArray(contacts) ? contacts : [];

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/contacts/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] }),
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/contacts/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contacts"] });
      setDeleteTarget(null);
      toast({ title: "Message deleted" });
    },
    onError: () => toast({ title: "Failed to delete message", variant: "destructive" }),
  });

  const sendReply = useMutation({
    mutationFn: (data: { email: string; clientName: string; subject: string; message: string; contactId: string }) =>
      apiRequest("POST", "/api/admin/send-email", data),
    onSuccess: (_data, vars) => {
      updateStatusMutation.mutate({ id: vars.contactId, status: "responded" });
      toast({ title: "Reply sent successfully" });
      setReplyContact(null);
      setReplySubject("");
      setReplyMessage("");
    },
    onError: () => toast({ title: "Failed to send reply", variant: "destructive" }),
  });

  const filteredContacts = safeContacts.filter(contact => {
    const name = contact.name || "";
    const email = contact.email || "";
    const message = contact.message || "";
    const status = contact.status || "unread";
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!name.toLowerCase().includes(s) && !email.toLowerCase().includes(s) && !message.toLowerCase().includes(s))
        return false;
    }
    if (statusFilter !== "all" && status !== statusFilter) return false;
    if (dateFilter === "today") {
      if (new Date().toDateString() !== new Date(contact.createdAt).toDateString()) return false;
    }
    return true;
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const statusColor = (s: string) =>
    s === "unread" ? "bg-red-500" : s === "read" ? "bg-blue-500" : s === "responded" ? "bg-green-500" : "bg-gray-500";

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareIcon className="w-5 h-5" />
            Contact Messages
          </CardTitle>
          <CardDescription>
            Review, respond to, and manage client inquiries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search by name, email, or message…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
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
                Showing {filteredContacts.length} of {safeContacts.length} messages
              </span>
              <Button variant="outline" size="sm"
                onClick={() => { setSearchTerm(""); setStatusFilter("all"); setDateFilter("all"); }}>
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {safeContacts.length === 0 ? "No contact messages yet." : "No messages match your filters."}
              </div>
            ) : (
              filteredContacts.slice().reverse().map((contact) => (
                <Card key={contact.id} className="relative">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <UserIcon className="w-4 h-4 text-gray-500 shrink-0" />
                          <h3 className="font-semibold text-sm">{contact.name}</h3>
                          <Badge className={`${statusColor(contact.status || "unread")} text-white text-[10px]`}>
                            {(contact.status || "unread").toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <MailIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline truncate">
                            {contact.email}
                          </a>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{contact.message}</p>
                      </div>
                      <div className="text-xs text-gray-400 shrink-0 text-right">
                        {formatDate(contact.createdAt)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-3 border-t">
                      {/* Reply */}
                      <Button size="sm" variant="outline"
                        onClick={() => {
                          setReplyContact(contact);
                          setReplySubject(`Re: Message from ${contact.name}`);
                          setReplyMessage("");
                          if (contact.status === "unread") {
                            updateStatusMutation.mutate({ id: contact.id, status: "read" });
                          }
                        }}>
                        <Mail className="w-3.5 h-3.5 mr-1.5" /> Reply
                      </Button>
                      {/* Mark read/unread toggle */}
                      {contact.status !== "responded" && (
                        <Button size="sm" variant="outline"
                          onClick={() => updateStatusMutation.mutate({
                            id: contact.id,
                            status: contact.status === "unread" ? "read" : "unread",
                          })}>
                          <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                          {contact.status === "unread" ? "Mark Read" : "Mark Unread"}
                        </Button>
                      )}
                      {/* Delete */}
                      <Button size="sm" variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                        onClick={() => setDeleteTarget(contact)}>
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

      {/* Reply Dialog */}
      <Dialog open={!!replyContact} onOpenChange={(open) => !open && setReplyContact(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {replyContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>To</Label>
              <p className="text-sm text-muted-foreground mt-1">{replyContact?.email}</p>
            </div>
            <div>
              <Label htmlFor="reply-subject">Subject</Label>
              <Input id="reply-subject" value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="reply-message">Message</Label>
              <Textarea id="reply-message" value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)} rows={6} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyContact(null)}>Cancel</Button>
            <Button
              disabled={!replySubject || !replyMessage || sendReply.isPending}
              onClick={() => {
                if (!replyContact) return;
                sendReply.mutate({
                  email: replyContact.email,
                  clientName: replyContact.name,
                  subject: replySubject,
                  message: replyMessage,
                  contactId: replyContact.id,
                });
              }}>
              {sendReply.isPending ? "Sending…" : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
            <Button variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
