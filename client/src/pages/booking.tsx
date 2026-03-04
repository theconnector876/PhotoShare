import BookingCalculator from "@/components/booking-calculator";

export default function Booking() {
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const photographerId = searchParams?.get("photographerId") || searchParams?.get("photographer") || undefined;
  const customPackageId = searchParams?.get("pkg") || undefined;

  return (
    <div className="pt-16 relative z-10">
      <BookingCalculator photographerId={photographerId} customPackageId={customPackageId} />
    </div>
  );
}
