import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { defaultPricingConfig } from "@shared/pricing";

export function AdminPricing() {
  const { toast } = useToast();
  const [rawConfig, setRawConfig] = useState(JSON.stringify(defaultPricingConfig, null, 2));

  const { data } = useQuery({
    queryKey: ["/api/pricing"],
    retry: false,
  });

  useEffect(() => {
    if (data) {
      setRawConfig(JSON.stringify(data, null, 2));
    }
  }, [data]);

  const updatePricingMutation = useMutation({
    mutationFn: async (config: Record<string, unknown>) => {
      await apiRequest("PUT", "/api/admin/pricing", { config });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing"] });
      toast({
        title: "Pricing Updated",
        description: "Global pricing configuration saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update pricing configuration.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    try {
      const parsed = JSON.parse(rawConfig);
      updatePricingMutation.mutate(parsed);
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Fix JSON formatting before saving.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Pricing</CardTitle>
        <CardDescription>
          Edit the pricing configuration for packages, add-ons, and fees.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={18}
          value={rawConfig}
          onChange={(event) => setRawConfig(event.target.value)}
          className="font-mono text-xs"
        />
        <Button onClick={handleSave} disabled={updatePricingMutation.isPending}>
          {updatePricingMutation.isPending ? "Saving..." : "Save Pricing"}
        </Button>
      </CardContent>
    </Card>
  );
}
