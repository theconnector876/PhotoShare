import { Card } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, Clock, DollarSign, Camera, Shield } from "lucide-react";

export default function Terms() {
  return (
    <div className="pt-16 pb-20 bg-background relative z-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text">
            Terms & Conditions
          </h1>
          <p className="text-xl text-muted-foreground">
            Photography/Videography Service Agreement
          </p>
        </div>

        <Card className="p-8 mb-8 hover-3d">
          <div className="flex items-center mb-6">
            <Camera className="text-primary mr-3" size={24} />
            <h2 className="text-2xl font-bold">Service Agreement Overview</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            This contract pertains to the provision of services and products for a PHOTOGRAPHY/PRODUCTIONS event 
            scheduled to occur at the specified time and venue by The Connector Photography.
          </p>
        </Card>

        {/* Key Terms Summary */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 hover-3d">
            <div className="flex items-center mb-4">
              <CheckCircle className="text-green-500 mr-3" size={20} />
              <h3 className="text-lg font-semibold">Service Provision</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              We deliver a minimum number of photos as stipulated in your chosen package. 
              The specific number varies by package selected.
            </p>
          </Card>

          <Card className="p-6 hover-3d">
            <div className="flex items-center mb-4">
              <DollarSign className="text-jamaica-gold mr-3" size={20} />
              <h3 className="text-lg font-semibold">Payment Terms</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              50% deposit required to secure your event date. Payment by check or cash. 
              Deposits are non-refundable even for date changes or cancellations.
            </p>
          </Card>

          <Card className="p-6 hover-3d">
            <div className="flex items-center mb-4">
              <Clock className="text-blue-500 mr-3" size={20} />
              <h3 className="text-lg font-semibold">Delivery Schedule</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Final packages delivered 2-4 weeks after your event. Platinum package includes 
              same-day preview images for immediate enjoyment.
            </p>
          </Card>

          <Card className="p-6 hover-3d">
            <div className="flex items-center mb-4">
              <AlertTriangle className="text-orange-500 mr-3" size={20} />
              <h3 className="text-lg font-semibold">Overtime Charges</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Additional $100 per hour if agreed timeframe is exceeded. 
              Client responsible for any equipment damage caused by event attendees.
            </p>
          </Card>
        </div>

        {/* Complete Terms & Conditions */}
        <Card className="p-8 hover-3d">
          <div className="flex items-center mb-6">
            <Shield className="text-primary mr-3" size={24} />
            <h2 className="text-2xl font-bold">Complete Terms & Conditions</h2>
          </div>
          
          <div className="space-y-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2 text-primary">1. Service Provision</h4>
              <p className="text-muted-foreground">
                The Photographer(s)/Producer(s) agree(s) to deliver a minimum number of photos as stipulated in the chosen package. 
                No more than this specified number of images is required to be provided.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">2. Post-Processing</h4>
              <p className="text-muted-foreground">
                Post-processing or digital image editing services will be performed on the photos and/or video footage 
                as artistically necessary, depending on the selected package.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">3. Image Usage Rights</h4>
              <p className="text-muted-foreground">
                The Client(s) grant(s) permission to the Photographer(s)/Producer(s) and its assigns, licensees, and sub-licensees 
                to utilize the likeness, images, and video footage of the Client(s) for various purposes, including commercial use, 
                advertising, and personal use.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">4. Promotional Use</h4>
              <p className="text-muted-foreground">
                The Photographer(s)/Producer(s) reserve(s) the right to promote photos containing the likeness of the Client(s) to third parties.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">5. Assignment of Photographer</h4>
              <p className="text-muted-foreground">
                Client(s) acknowledge(s) that the specific Photographer(s)/Producer(s) assigned to the event may vary.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">6. Subcontracting</h4>
              <p className="text-muted-foreground">
                The Photographer(s)/Producer(s) may subcontract second shooters or assign other qualified photographers 
                associated with the Photography Company to fulfill the obligations under this contract.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">7. Refund Policy</h4>
              <p className="text-muted-foreground">
                Refunds are applicable only in cases where the Photographer(s)/Producer(s) breach the terms and conditions 
                of this contract. Deposits are non-refundable even in the event of date changes or cancellations.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">8. Force Majeure</h4>
              <p className="text-muted-foreground">
                Photographer(s)/Producer(s) shall not be held responsible for any disruptions or damages caused by 
                unforeseen events such as natural disasters or accidents.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">9. Overtime Charges</h4>
              <p className="text-muted-foreground">
                Should the agreed-upon timeframe be exceeded, an additional fee of $100 per hour will be incurred, 
                added to the final price.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">10. Equipment Damage</h4>
              <p className="text-muted-foreground">
                The Client(s) shall be held responsible for any damage to equipment caused by individuals attending the event.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">11. Payment Method</h4>
              <p className="text-muted-foreground">
                Payment shall be made by check or cash, with special agreements requiring a payment of 50% of the selected 
                package price to secure the event date.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">12. Payment Decline</h4>
              <p className="text-muted-foreground">
                The Client(s) shall bear any bank fees resulting from declined payments.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">13. Delivery Schedule</h4>
              <p className="text-muted-foreground">
                Final packages shall be delivered two to four weeks prior to the event date, subsequent to the capture of images.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">14. Refund for Breach</h4>
              <p className="text-muted-foreground">
                Refunds are applicable if the terms and conditions of this contract are breached by the Photographer(s)/Producer(s).
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">15. Failure to Deliver</h4>
              <p className="text-muted-foreground">
                In the event of failure to deliver photographs for any reason, the Client(s) shall be entitled to a refund of all deposits made.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">16. No Client Breach Refund</h4>
              <p className="text-muted-foreground">
                No refund shall be granted if the Client(s) breach the terms and conditions of this contract, holding the Client(s) fully responsible.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">17. Location Provision</h4>
              <p className="text-muted-foreground">
                The Client(s) shall provide the location for photography. Client(s) shall cover all fees associated with the location, 
                including but not limited to licensing and travel expenses.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">18. Client Responsibility</h4>
              <p className="text-muted-foreground">
                The Client(s) shall abide by the rules outlined in this contract and shall be held liable for any breaches thereof.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">19. Collection Inspection</h4>
              <p className="text-muted-foreground">
                The Client(s) are responsible for inspecting all photographs, flash drives, or discs upon collection.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">20. Liability</h4>
              <p className="text-muted-foreground">
                The Photographer(s)/Producer(s) shall not be liable for loss of photographs due to theft, fire, natural disasters, 
                or any failure to deliver photographs for any reason.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">21. Uncollected Photographs</h4>
              <p className="text-muted-foreground">
                Photographs left uncollected for more than 21 days after post-production and notification to the Client(s) 
                will incur a reproduction cost.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-primary">22. Refreshments and Food Coverage</h4>
              <p className="text-muted-foreground">
                The Client(s) shall provide refreshments and meals for the production team during the duration of the event coverage. 
                Failure to provide adequate refreshments and meals may result in interruptions of coverage.
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-center text-muted-foreground text-sm">
              This contract shall be governed by the laws of <strong>THE CONNECTOR'S COMPANY</strong>.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}