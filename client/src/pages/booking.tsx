import BookingCalculator from "@/components/booking-calculator";
import CustomPackageBooking from "@/components/custom-package-booking";

export default function Booking() {
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const photographerId = searchParams?.get("photographerId") || searchParams?.get("photographer") || undefined;
  const customPackageId = searchParams?.get("pkg") || undefined;

  if (customPackageId) {
    return (
      <div className="pt-16 relative z-10">
        <CustomPackageBooking packageId={customPackageId} photographerId={photographerId} />
      </div>
    );
  }

  return (
    <div className="pt-16 relative z-10">
      <BookingCalculator photographerId={photographerId} />
    </div>
  );
}
