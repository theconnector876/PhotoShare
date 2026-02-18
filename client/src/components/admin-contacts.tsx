import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageSquareIcon, MailIcon, UserIcon } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [replyContact, setReplyContact] = useState<ContactMessage | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const sendReply = useMutation({
    mutationFn: (data: { email: string; clientName: string; subject: string; message: string }) =>
      apiRequest("POST", "/api/admin/send-email", data),
    onSuccess: () => {
      toast({ title: "Reply sent successfully" });
      setReplyContact(null);
      setReplySubject("");
      setReplyMessage("");
    },
    onError: () => {
      toast({ title: "Failed to send reply", variant: "destructive" });
    },
  });

  const { data: contacts, isLoading } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contacts"],
    retry: false,
  });

  const safeContacts = Array.isArray(contacts) ? contacts : [];

  // Filter contacts based on search and filter criteria
  const filteredContacts = safeContacts.filter(contact => {
    const name = contact.name || "";
    const email = contact.email || "";
    const message = contact.message || "";
    const status = contact.status || "unread";
    // Search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        name.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        message.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== "all" && status !== statusFilter) return false;

    // Date filter (today only)
    if (dateFilter === "today") {
      const today = new Date().toDateString();
      const contactDate = new Date(contact.createdAt).toDateString();
      if (today !== contactDate) return false;
    }

    return true;
  }) || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "unread":
        return "bg-red-500";
      case "read":
        return "bg-blue-500";
      case "responded":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
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
            Review and respond to client inquiries and contact messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search by name, email, or message content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                  data-testid="input-search-contacts"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="responded">Responded</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setDateFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger data-testid="select-date-filter">
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today Only</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center">
                <div className="text-sm text-gray-600">
                  Showing {filteredContacts.length} of {contacts?.length || 0} messages
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {safeContacts.length === 0 ? "No contact messages found." : "No messages match your filters."}
              </div>
            ) : (
              filteredContacts.map((contact: ContactMessage) => (
                <Card key={contact.id} className="relative">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <UserIcon className="w-4 h-4 text-gray-500" />
                          <h3 className="text-lg font-semibold" data-testid={`contact-name-${contact.id}`}>
                            {contact.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <MailIcon className="w-4 h-4 text-gray-500" />
                          <p className="text-sm text-gray-600" data-testid={`contact-email-${contact.id}`}>
                            {contact.email}
                          </p>
                        </div>
                        <p className="text-sm text-gray-700 mt-2" data-testid={`contact-message-${contact.id}`}>
                          {contact.message}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          className={`${getStatusColor(contact.status || "unread")} text-white mb-2`}
                          data-testid={`contact-status-${contact.id}`}
                        >
                          {(contact.status || "unread").toUpperCase()}
                        </Badge>
                        <div className="text-xs text-gray-500">
                          {formatDate(contact.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplyContact(contact);
                            setReplySubject(`Re: Message from ${contact.name}`);
                            setReplyMessage("");
                          }}
                          data-testid={`button-reply-${contact.id}`}
                        >
                          <MailIcon className="w-4 h-4 mr-2" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
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
                });
              }}
            >
              {sendReply.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}