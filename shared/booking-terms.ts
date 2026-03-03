export interface TermsSection {
  title: string;
  content: string;
}

export interface BookingTerms {
  header: string;
  sections: TermsSection[];
}

export const DEFAULT_BOOKING_TERMS: BookingTerms = {
  header:
    "This contract pertains to the provision of photography and production services for an event scheduled to occur at the specified time and venue by ConnectAGrapher.",
  sections: [
    {
      title: "1. Service Provision",
      content:
        "ConnectAGrapher agrees to deliver a minimum number of photos as stipulated in the chosen package. No more than this specified number of images is required to be provided.",
    },
    {
      title: "2. Post-Processing",
      content:
        "Post-processing and digital image editing services will be performed on the photos and/or video footage as artistically necessary, depending on the selected package.",
    },
    {
      title: "3. Image Usage Rights",
      content:
        "The Client(s) grant permission to ConnectAGrapher and its assigns, licensees, and sub-licensees to utilise the likeness, images, and video footage for purposes including commercial use, advertising, and portfolio display, unless a written opt-out is provided.",
    },
    {
      title: "4. Payment Terms",
      content:
        "A 50% deposit is required at the time of booking, processed securely through our online payment platform. The remaining balance is due prior to or on the day of the session. Cash payments on the day of the shoot may be accepted by prior arrangement. Deposits are non-refundable in the event of rescheduling or cancellation by the client.",
    },
    {
      title: "5. Delivery Timeline",
      content:
        "Edited images will be delivered within 5–7 business days for portrait sessions and events, and 2–4 weeks for weddings. Platinum package clients receive same-day preview images.",
    },
    {
      title: "6. Overtime Policy",
      content:
        "If the session exceeds the agreed timeframe, additional charges of $100 per hour apply. The client is responsible for any damage to equipment caused by attendees.",
    },
    {
      title: "7. Assignment & Subcontracting",
      content:
        "The specific photographer assigned to your session may vary. ConnectAGrapher reserves the right to assign qualified second shooters or subcontractors as needed.",
    },
    {
      title: "8. Cancellation Policy",
      content:
        "Cancellations by the client forfeit the non-refundable deposit. If cancellation is due to photographer unavailability, a full refund will be provided.",
    },
    {
      title: "9. Liability",
      content:
        "ConnectAGrapher's liability is limited to the total contract value. We maintain equipment backup and professional insurance for reliability.",
    },
    {
      title: "10. Governing Law",
      content:
        "This contract is governed by the applicable laws of ConnectAGrapher's operating jurisdiction.",
    },
  ],
};
