import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InboxIcon, MailIcon, Trash2, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface InboundEmail {
  id: string;
  from: string;
  to: string;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  isRead: boolean;
  receivedAt: string;
}

export function AdminInboundEmails() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [viewEmail, setViewEmail] = useState<InboundEmail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InboundEmail | null>(null);

  const { data: emails, isLoading } = useQuery<InboundEmail[]>({
    queryKey: ["/api/admin/inbound-emails"],
    retry: false,
  });

  const safeEmails = Array.isArray(emails) ? emails : [];

  const markReadMutation = useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      apiRequest("PATCH", `/api/admin/inbound-emails/${id}/read`, { isRead }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/inbound-emails"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/inbound-emails/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inbound-emails"] });
      setDeleteTarget(null);
      toast({ title: "Email deleted" });
    },
    onError: () => toast({ title: "Failed to delete email", variant: "destructive" }),
  });

  const filtered = safeEmails
    .slice()
    .reverse()
    .filter((e) => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return (
        e.from.toLowerCase().includes(s) ||
        (e.subject || "").toLowerCase().includes(s) ||
        (e.textBody || "").toLowerCase().includes(s)
      );
    });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const openEmail = (email: InboundEmail) => {
    setViewEmail(email);
    if (!email.isRead) {
      markReadMutation.mutate({ id: email.id, isRead: true });
    }
  };

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
            <InboxIcon className="w-5 h-5" />
            Inbox
          </CardTitle>
          <CardDescription>Emails received via Resend inbound.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-3">
            <Input
              placeholder="Search by sender, subject, or body…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            {searchTerm && (
              <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
                Clear
              </Button>
            )}
          </div>

          <div className="text-sm text-gray-500 mb-3">
            {filtered.length} of {safeEmails.length} emails
            {safeEmails.filter((e) => !e.isRead).length > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({safeEmails.filter((e) => !e.isRead).length} unread)
              </span>
            )}
          </div>

          <div className="grid gap-3">
            {filtered.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                {safeEmails.length === 0 ? "No emails received yet." : "No emails match your search."}
              </div>
            ) : (
              filtered.map((email) => (
                <Card
                  key={email.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${!email.isRead ? "border-blue-300 bg-blue-50/30" : ""}`}
                  onClick={() => openEmail(email)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <MailIcon className="w-4 h-4 text-gray-400 shrink-0" />
                          <span className={`text-sm truncate font-${email.isRead ? "normal" : "semibold"}`}>
                            {email.from}
                          </span>
                          {!email.isRead && (
                            <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">NEW</Badge>
                          )}
                        </div>
                        <p className={`text-sm truncate ${email.isRead ? "text-gray-600" : "text-gray-900 font-medium"}`}>
                          {email.subject || "(no subject)"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {(email.textBody || "").slice(0, 100) || "(no body)"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-xs text-gray-400">{formatDate(email.receivedAt)}</span>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => markReadMutation.mutate({ id: email.id, isRead: !email.isRead })}
                            title={email.isRead ? "Mark unread" : "Mark read"}
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-red-500 hover:bg-red-50"
                            onClick={() => setDeleteTarget(email)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Email Dialog */}
      <Dialog open={!!viewEmail} onOpenChange={(open) => !open && setViewEmail(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewEmail?.subject || "(no subject)"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="bg-gray-50 rounded p-3 space-y-1">
              <p><span className="font-medium">From:</span> {viewEmail?.from}</p>
              <p><span className="font-medium">To:</span> {viewEmail?.to}</p>
              <p><span className="font-medium">Received:</span> {viewEmail && formatDate(viewEmail.receivedAt)}</p>
            </div>
            {viewEmail?.htmlBody ? (
              <div
                className="border rounded p-3 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: viewEmail.htmlBody }}
              />
            ) : (
              <div className="border rounded p-3 whitespace-pre-wrap text-gray-700">
                {viewEmail?.textBody || "(no body)"}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Delete email from <strong>{deleteTarget?.from}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
