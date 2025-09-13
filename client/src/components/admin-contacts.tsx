import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquareIcon, MailIcon, UserIcon } from "lucide-react";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
}

export function AdminContacts() {
  const { data: contacts, isLoading } = useQuery<ContactMessage[]>({
    queryKey: ["/api/admin/contacts"],
    retry: false,
  });

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
          <div className="grid gap-4">
            {contacts?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No contact messages found.
              </div>
            ) : (
              contacts?.map((contact: ContactMessage) => (
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
                      </div>
                      <Badge 
                        className={`${getStatusColor(contact.status)} text-white`}
                        data-testid={`contact-status-${contact.id}`}
                      >
                        {contact.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-sm mb-2">Message:</h4>
                      <div 
                        className="bg-gray-50 p-3 rounded-md text-sm whitespace-pre-wrap"
                        data-testid={`contact-message-${contact.id}`}
                      >
                        {contact.message}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-xs text-gray-500">
                        Received on {formatDate(contact.createdAt)}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`mailto:${contact.email}`, '_blank')}
                          data-testid={`button-reply-${contact.id}`}
                        >
                          Reply via Email
                        </Button>
                        {contact.status === "unread" && (
                          <Button
                            size="sm"
                            data-testid={`button-mark-read-${contact.id}`}
                          >
                            Mark as Read
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}