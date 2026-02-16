import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import BookingCalculator from "@/components/booking-calculator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PhotographerPublic = {
  id: string;
  displayName: string;
};

export default function PhotographerBooking() {
  const [match, params] = useRoute("/book/:photographerId");
  const photographerId = match ? params?.photographerId : undefined;

  const { data } = useQuery<PhotographerPublic>({
    queryKey: [`/api/photographers/${photographerId}/public`],
    enabled: !!photographerId,
  });

  if (!photographerId) {
    return null;
  }

  return (
    <div className="pt-16 relative z-10 space-y-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Book with {data?.displayName || "Photographer"}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You are booking a session directly with this photographer. Pricing and availability are
          based on their current settings.
        </CardContent>
      </Card>
      <BookingCalculator photographerId={photographerId} />
    </div>
  );
}
