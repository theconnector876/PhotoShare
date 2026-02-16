import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, CheckCircleIcon, XCircleIcon, Edit } from "lucide-react";
import { defaultPricingConfig, type PricingConfig } from "@shared/pricing";

type PendingPhotographer = {
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    photographerStatus?: string | null;
  };
  profile?: {
    displayName?: string | null;
    location?: string | null;
    specialties?: string[] | null;
    portfolioLinks?: string[] | null;
  };
};

type Photographer = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  photographerStatus?: string | null;
};

export function AdminPhotographers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string | null>(null);
  const [pricingRaw, setPricingRaw] = useState(JSON.stringify(defaultPricingConfig, null, 2));

  const { data: pending, isLoading } = useQuery<PendingPhotographer[]>({
    queryKey: ["/api/admin/photographers/pending"],
  });

  const { data: photographers } = useQuery<Photographer[]>({
    queryKey: ["/api/admin/photographers"],
  });

  const { data: selectedPricing } = useQuery<{ config: PricingConfig } | null>({
    queryKey: ["/api/admin/photographers", selectedPhotographerId, "pricing"],
    enabled: !!selectedPhotographerId,
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(`/api/admin/photographers/${userId}/approve`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photographers/pending"] });
      toast({ title: "Photographer approved" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve photographer", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest(`/api/admin/photographers/${userId}/reject`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photographers/pending"] });
      toast({ title: "Photographer rejected" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject photographer", variant: "destructive" });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ userId, config }: { userId: string; config: PricingConfig }) => {
      await apiRequest(`/api/admin/photographers/${userId}/pricing`, "PUT", { config });
    },
    onSuccess: () => {
      toast({ title: "Pricing updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update pricing", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (selectedPricing?.config) {
      setPricingRaw(JSON.stringify(selectedPricing.config, null, 2));
    }
  }, [selectedPricing]);

  useEffect(() => {
    if (!selectedPhotographerId) {
      setPricingRaw(JSON.stringify(defaultPricingConfig, null, 2));
    }
  }, [selectedPhotographerId]);

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
            <Camera className="w-5 h-5" />
            Photographer Approvals
          </CardTitle>
          <CardDescription>
            Review and approve photographer accounts before they can accept bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!pending || pending.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending photographers.
            </div>
          ) : (
            <div className="grid gap-4">
              {pending.map((item) => (
                <Card key={item.user.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">
                            {item.profile?.displayName || `${item.user.firstName ?? ""} ${item.user.lastName ?? ""}`.trim()}
                          </h4>
                          <Badge variant="secondary">Pending</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.user.email}
                        </div>
                        {item.profile?.location && (
                          <div className="text-sm">Location: {item.profile.location}</div>
                        )}
                        {!!item.profile?.specialties?.length && (
                          <div className="text-sm">
                            Specialties: {item.profile.specialties.join(", ")}
                          </div>
                        )}
                        {!!item.profile?.portfolioLinks?.length && (
                          <div className="text-sm">
                            Portfolio: {item.profile.portfolioLinks.join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(item.user.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectMutation.mutate(item.user.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircleIcon className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Photographer Pricing
          </CardTitle>
          <CardDescription>
            Update pricing configurations on behalf of photographers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!photographers || photographers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No photographers found.
            </div>
          ) : (
            <div className="grid gap-3">
              {photographers.map((photographer) => (
                <div
                  key={photographer.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <div className="font-medium">
                      {photographer.firstName || photographer.lastName
                        ? `${photographer.firstName ?? ""} ${photographer.lastName ?? ""}`.trim()
                        : photographer.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {photographer.photographerStatus || "pending"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedPhotographerId(photographer.id)}
                  >
                    Edit Pricing
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedPhotographerId} onOpenChange={() => setSelectedPhotographerId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Photographer Pricing</DialogTitle>
            <DialogDescription>
              Paste valid JSON to update the photographer's pricing configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              rows={14}
              value={pricingRaw}
              onChange={(event) => setPricingRaw(event.target.value)}
              className="font-mono text-xs"
            />
            <Button
              onClick={() => {
                if (!selectedPhotographerId) return;
                try {
                  const parsed = JSON.parse(pricingRaw) as PricingConfig;
                  updatePricingMutation.mutate({ userId: selectedPhotographerId, config: parsed });
                } catch (error) {
                  toast({
                    title: "Invalid JSON",
                    description: "Fix JSON formatting before saving.",
                    variant: "destructive",
                  });
                }
              }}
              disabled={updatePricingMutation.isPending}
            >
              {updatePricingMutation.isPending ? "Saving..." : "Save Pricing"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
