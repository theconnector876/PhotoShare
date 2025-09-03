import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useBookingCalculator } from "@/hooks/use-booking-calculator";
import PackageCard from "@/components/package-card";
import { Camera, Heart, Users, Plus, Minus } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const bookingFormSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  email: z.string().email("Valid email is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  numberOfPeople: z.number().min(1, "At least 1 person is required"),
  shootDate: z.string().min(1, "Shoot date is required"),
  shootTime: z.string().min(1, "Shoot time is required"),
  location: z.string().min(1, "Location details are required"),
  parish: z.string().min(1, "Parish selection is required"),
  referralSource: z.array(z.string()).default([]),
  clientInitials: z.string().min(1, "Client initials are required").max(5, "Initials too long"),
  contractAccepted: z.boolean().refine((val) => val, "You must accept the contract terms"),
});

type BookingFormData = z.infer<typeof bookingFormSchema>;

export default function BookingCalculator() {
  const { calculation, packages, eventHours, updateService, updatePackage, updatePeople, updateTransportation, updateEventHours, toggleAddon } = useBookingCalculator();
  const { toast } = useToast();

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      clientName: "",
      email: "",
      contactNumber: "",
      numberOfPeople: 1,
      shootDate: "",
      shootTime: "",
      location: "",
      parish: "manchester-stelizabeth",
      referralSource: [],
      clientInitials: "",
      contractAccepted: false,
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const bookingData = {
        ...data,
        serviceType: calculation.serviceType,
        packageType: calculation.packageType,
        transportationFee: calculation.transportationFee,
        addons: calculation.addons,
        totalPrice: calculation.totalPrice,
      };
      
      return apiRequest('POST', '/api/bookings', bookingData);
    },
    onSuccess: () => {
      toast({
        title: "Booking Confirmed!",
        description: "We'll contact you soon to confirm the details. Check your email for booking information.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
    onError: () => {
      toast({
        title: "Booking Failed",
        description: "There was an error submitting your booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookingFormData) => {
    createBookingMutation.mutate(data);
  };

  const serviceTypes = [
    {
      id: 'photoshoot' as const,
      name: 'Photoshoot',
      description: 'Personal & Portrait Sessions',
      icon: Users,
      gradient: 'from-accent to-primary',
    },
    {
      id: 'wedding' as const,
      name: 'Wedding',
      description: 'Complete Wedding Packages',
      icon: Heart,
      gradient: 'from-primary to-secondary',
    },
    {
      id: 'event' as const,
      name: 'Event',
      description: 'Corporate & Social Events',
      icon: Camera,
      gradient: 'from-secondary to-accent',
    },
  ];

  const addons = [
    { id: 'highlightReel', label: 'Highlight Reel', description: '1-3 min video', price: 250 },
    { id: 'expressDelivery', label: 'Express Delivery', description: '1-2 days', price: 120 },
    { id: 'drone', label: 'Drone Photography', description: 'Aerial shots', price: calculation.serviceType === 'wedding' ? 250 : 150 },
    { id: 'studioRental', label: 'Studio Rental', description: 'Professional studio', price: 80 },
    { id: 'flyingDress', label: 'Flying Dress', description: 'Dramatic dress rental', price: 120 },
    { id: 'clearKayak', label: 'Clear Kayak', description: 'Water photoshoot prop', price: 100 },
  ];

  return (
    <div className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5 relative z-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text">Book Your Session</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose your package and get instant pricing
          </p>
        </div>

        {/* Service Type Selection */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold mb-6 text-center">Select Service Type</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {serviceTypes.map((service) => (
              <Card
                key={service.id}
                className={`p-6 cursor-pointer hover-3d transition-all duration-300 ${
                  calculation.serviceType === service.id 
                    ? 'border-primary bg-primary/10 shadow-lg' 
                    : 'border-transparent hover:border-primary'
                }`}
                onClick={() => updateService(service.id)}
                data-testid={`service-${service.id}`}
              >
                <div className="text-center">
                  <div className={`w-12 h-12 bg-gradient-to-r ${service.gradient} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <service.icon className="text-white h-6 w-6" />
                  </div>
                  <h4 className="text-xl font-semibold mb-2">{service.name}</h4>
                  <p className="text-muted-foreground text-sm">{service.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Package Selection */}
        {calculation.serviceType === 'photoshoot' && (
          <div className="mb-12">
            <h3 className="text-2xl font-bold mb-6 text-center">Photoshoot Packages</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <PackageCard
                name="Bronze"
                price={150}
                duration={45}
                images={6}
                locations={1}
                color="bronze"
                features={[]}
                isSelected={calculation.packageType === 'bronze'}
                onClick={() => updatePackage('bronze')}
              />
              <PackageCard
                name="Silver"
                price={200}
                duration={60}
                images={10}
                locations={1}
                color="silver"
                features={[]}
                isSelected={calculation.packageType === 'silver'}
                onClick={() => updatePackage('silver')}
              />
              <PackageCard
                name="Gold"
                price={300}
                duration={120}
                images={15}
                locations={1}
                color="gold"
                features={[]}
                isSelected={calculation.packageType === 'gold'}
                onClick={() => updatePackage('gold')}
              />
              <PackageCard
                name="Platinum"
                price={500}
                duration={150}
                images={25}
                locations={2}
                color="platinum"
                features={[]}
                isSelected={calculation.packageType === 'platinum'}
                onClick={() => updatePackage('platinum')}
              />
            </div>
          </div>
        )}

        {/* Wedding Packages */}
        {calculation.serviceType === 'wedding' && (
          <div className="mb-12">
            <h3 className="text-2xl font-bold mb-6 text-center">Wedding Packages</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <PackageCard
                name="Bronze"
                price={packages.wedding.photography.bronze}
                color="bronze"
                features={[
                  { text: "Professional photographer", icon: "camera" },
                  { text: "Basic editing", icon: "edit" },
                  { text: "Digital gallery", icon: "globe" }
                ]}
                isSelected={calculation.packageType === 'bronze'}
                onClick={() => updatePackage('bronze')}
              />
              <PackageCard
                name="Silver"
                price={packages.wedding.photography.silver}
                color="silver"
                features={[
                  { text: "Extended photography", icon: "camera" },
                  { text: "Enhanced editing", icon: "edit" },
                  { text: "Online gallery", icon: "globe" },
                  { text: "Print release", icon: "print" }
                ]}
                isSelected={calculation.packageType === 'silver'}
                onClick={() => updatePackage('silver')}
              />
              <PackageCard
                name="Gold"
                price={packages.wedding.photography.gold}
                color="gold"
                features={[
                  { text: "Full day coverage", icon: "camera" },
                  { text: "Professional editing", icon: "edit" },
                  { text: "Premium gallery", icon: "globe" },
                  { text: "USB drive", icon: "storage" },
                  { text: "Print package", icon: "print" }
                ]}
                isSelected={calculation.packageType === 'gold'}
                onClick={() => updatePackage('gold')}
              />
              <PackageCard
                name="Platinum"
                price={packages.wedding.photography.platinum}
                color="platinum"
                features={[
                  { text: "2 photographers", icon: "camera" },
                  { text: "Luxury experience", icon: "star" },
                  { text: "Same-day preview", icon: "preview" },
                  { text: "Premium albums", icon: "book" },
                  { text: "All inclusions", icon: "check" }
                ]}
                isSelected={calculation.packageType === 'platinum'}
                onClick={() => updatePackage('platinum')}
              />
            </div>
            
            {/* Videography Add-on for Wedding */}
            <div className="mt-8">
              <Card className="p-6 hover-3d">
                <h4 className="text-lg font-semibold mb-4">Add Videography</h4>
                <div className="grid md:grid-cols-4 gap-4">
                  {Object.entries(packages.wedding.videography).map(([tier, price]) => (
                    <div 
                      key={tier}
                      className={`p-4 border rounded-lg cursor-pointer transition-all duration-300 hover:border-primary ${
                        calculation.addons.includes(`videography-${tier}`) 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border'
                      }`}
                      onClick={() => toggleAddon(`videography-${tier}`)}
                    >
                      <div className="text-center">
                        <h5 className="font-semibold text-sm mb-1 capitalize">{tier}</h5>
                        <p className="text-2xl font-bold text-primary">${price}</p>
                        <p className="text-xs text-muted-foreground">Video Package</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Event Packages */}
        {calculation.serviceType === 'event' && (
          <div className="mb-12">
            <h3 className="text-2xl font-bold mb-6 text-center">Event Coverage</h3>
            <Card className="p-6 hover-3d">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-semibold mb-4">Hours of Coverage</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Duration: {eventHours} hours</Label>
                      <span className="text-lg font-semibold">${packages.event.baseRate}/hour</span>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={packages.event.minimumHours}
                        max="12"
                        value={eventHours}
                        onChange={(e) => updateEventHours(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
                        data-testid="slider-event-hours"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{packages.event.minimumHours}h</span>
                        <span>12h</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Minimum {packages.event.minimumHours} hours required. Additional hours at ${packages.event.baseRate}/hour.
                    </p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold mb-4">Event Pricing</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Photography ({eventHours} hours)</span>
                      <span>${packages.event.baseRate * eventHours}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between font-semibold">
                        <span>Base Price</span>
                        <span>${packages.event.baseRate * eventHours}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* People Counter and Location */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="p-6 hover-3d">
            <h4 className="text-lg font-semibold mb-4 flex items-center">
              <Users className="mr-2 text-primary" />
              Number of People
            </h4>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="icon"
                className="magnetic-btn"
                onClick={() => updatePeople(calculation.peopleCount - 1)}
                disabled={calculation.peopleCount <= 1}
                data-testid="decrease-people"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-2xl font-bold counter-animation" data-testid="people-count">
                {calculation.peopleCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="magnetic-btn"
                onClick={() => updatePeople(calculation.peopleCount + 1)}
                data-testid="increase-people"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Additional people: <span className="font-semibold text-primary">$50 each</span>
            </p>
          </Card>

          <Card className="p-6 hover-3d">
            <h4 className="text-lg font-semibold mb-4 flex items-center">
              <i className="fas fa-map-marker-alt mr-2 text-primary"></i>
              Location Parish
            </h4>
            <Select
              value={calculation.transportationFee.toString()}
              onValueChange={(value) => updateTransportation(parseInt(value))}
            >
              <SelectTrigger className="form-focus" data-testid="parish-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="35">Manchester & St. Elizabeth (+$35)</SelectItem>
                <SelectItem value="50">Montego Bay, Negril & Ocho Rios (+$50)</SelectItem>
                <SelectItem value="65">All Other Parishes (+$65)</SelectItem>
              </SelectContent>
            </Select>
          </Card>
        </div>

        {/* Add-ons */}
        <Card className="p-6 mb-8 hover-3d">
          <h4 className="text-lg font-semibold mb-6 flex items-center">
            <i className="fas fa-plus-circle mr-2 text-primary"></i>
            Add-ons & Extras
          </h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {addons.map((addon) => (
              <div
                key={addon.id}
                className={`addon-option flex items-center p-4 border rounded-lg cursor-pointer transition-all duration-300 magnetic-btn ${
                  calculation.addons.includes(addon.id) 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary'
                }`}
                onClick={() => toggleAddon(addon.id)}
                data-testid={`addon-${addon.id}`}
              >
                <Checkbox
                  checked={calculation.addons.includes(addon.id)}
                  className="mr-3"
                />
                <div>
                  <div className="font-semibold">{addon.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {addon.description} (+${addon.price})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Price Summary */}
        <Card className="bg-gradient-to-r from-primary to-secondary rounded-xl p-8 text-white text-center mb-8 animate-glow">
          <div className="text-lg mb-2">Total Investment</div>
          <div className="text-5xl font-bold counter-animation" data-testid="total-price">
            ${calculation.totalPrice}
          </div>
          <div className="text-sm opacity-90 mt-2">All pricing in USD</div>
        </Card>

        {/* Booking Form */}
        <Card className="p-8 hover-3d">
          <h4 className="text-2xl font-bold mb-6 text-center gradient-text">Complete Your Booking</h4>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Name *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter your full name" 
                          className="form-focus"
                          data-testid="input-client-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="your.email@example.com" 
                          className="form-focus"
                          data-testid="input-email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number *</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="876-XXX-XXXX" 
                          className="form-focus"
                          data-testid="input-contact"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numberOfPeople"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of People *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1}
                          readOnly
                          className="form-focus bg-muted"
                          data-testid="input-attendees"
                          {...field} 
                          value={calculation.peopleCount}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="shootDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Shoot *</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          className="form-focus"
                          data-testid="input-shoot-date"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shootTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time *</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          className="form-focus"
                          data-testid="input-shoot-time"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Location & Details *</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3}
                        placeholder="Describe your preferred location(s) and any special requests..."
                        className="form-focus"
                        data-testid="textarea-location"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parish"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parish</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="form-focus" data-testid="select-parish">
                          <SelectValue placeholder="Select parish" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manchester-stelizabeth">Manchester & St. Elizabeth</SelectItem>
                        <SelectItem value="montegobay-negril-ochorios">Montego Bay, Negril & Ocho Rios</SelectItem>
                        <SelectItem value="other-parishes">All Other Parishes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <Label className="text-sm font-semibold mb-3 block">How did you hear about us?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {['Search Engine', 'Social Media', 'Word of Mouth', 'Referral'].map((source, index) => (
                    <FormField
                      key={source}
                      control={form.control}
                      name="referralSource"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(source.toLowerCase().replace(' ', ''))}
                              onCheckedChange={(checked) => {
                                const value = source.toLowerCase().replace(' ', '');
                                const updated = checked
                                  ? [...(field.value || []), value]
                                  : (field.value || []).filter((item) => item !== value);
                                field.onChange(updated);
                              }}
                              data-testid={`checkbox-referral-${index}`}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal cursor-pointer">
                            {source}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <Card className="bg-muted p-6">
                <FormField
                  control={form.control}
                  name="contractAccepted"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-contract-accepted"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-semibold cursor-pointer">
                          I acknowledge that I have read, understand, and agree to the terms and conditions.
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          By checking this box, you agree to The Connector's photography contract terms, including usage rights, delivery timeline, and payment policies.
                        </p>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </Card>

              <FormField
                control={form.control}
                name="clientInitials"
                render={({ field }) => (
                  <FormItem className="max-w-[200px]">
                    <FormLabel>Client Initials *</FormLabel>
                    <FormControl>
                      <Input 
                        maxLength={5}
                        placeholder="ABC"
                        className="form-focus text-center font-bold"
                        data-testid="input-initials"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-primary to-secondary text-white py-4 text-lg font-semibold magnetic-btn animate-glow"
                disabled={createBookingMutation.isPending}
                data-testid="button-submit-booking"
              >
                <i className="fas fa-calendar-check mr-2"></i>
                {createBookingMutation.isPending 
                  ? 'Processing...' 
                  : `Confirm Booking - $${calculation.totalPrice}`
                }
              </Button>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
