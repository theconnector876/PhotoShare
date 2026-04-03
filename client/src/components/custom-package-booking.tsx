import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ShieldCheck as Shield, CaretDown as ChevronDown, CheckCircle, Warning as AlertTriangle, Tag } from "@phosphor-icons/react";
import type { BookingTerms } from "@shared/booking-terms";
import { DEFAULT_BOOKING_TERMS } from "@shared/booking-terms";

interface LineItem { name: string; price: number; }
interface CustomPackage {
  id: string;
  name: string;
  description: string | null;
  serviceType: string;
  totalPrice: number;
  depositAmount: number;
  currency: string;
  lineItems: LineItem[];
  createdBy: string | null;
}

const createSchema = (isLoggedIn: boolean) => {
  const base = z.object({
    clientName: z.string().min(1, "Name is required"),
    email: z.string().email("Valid email is required"),
    contactNumber: z.string().min(1, "Phone number is required"),
    shootDate: z.string().min(1, "Shoot date is required"),
    shootTime: z.string().min(1, "Shoot time is required"),
    location: z.string().min(1, "Location is required"),
    parish: z.string().min(1, "Parish is required"),
    clientInitials: z.string().min(1, "Initials are required").max(5),
    contractAccepted: z.boolean().refine(v => v, "You must accept the terms"),
    password: isLoggedIn ? z.string().optional() : z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: isLoggedIn ? z.string().optional() : z.string().min(1, "Please confirm your password"),
  });
  if (isLoggedIn) return base;
  return base.refine(d => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
};

type FormData = z.infer<ReturnType<typeof createSchema>>;

interface Props {
  packageId: string;
  photographerId?: string;
}

export default function CustomPackageBooking({ packageId, photographerId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const isLoggedIn = !!user;

  const { data: pkg, isLoading: pkgLoading, error: pkgError } = useQuery<CustomPackage>({
    queryKey: ["/api/custom-packages", packageId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/custom-packages/${packageId}`);
      if (!res.ok) throw new Error("Package not found");
      return res.json();
    },
    retry: false,
  });

  const { data: bookingTerms } = useQuery<BookingTerms>({
    queryKey: ["/api/booking-terms", photographerId],
    queryFn: async () => {
      const url = photographerId ? `/api/booking-terms?photographerId=${photographerId}` : "/api/booking-terms";
      const res = await fetch(url);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const terms = bookingTerms ?? DEFAULT_BOOKING_TERMS;

  const form = useForm<FormData>({
    resolver: zodResolver(createSchema(isLoggedIn)),
    defaultValues: {
      clientName: "", email: "", contactNumber: "",
      shootDate: "", shootTime: "", location: "",
      parish: "manchester-stelizabeth",
      clientInitials: "", contractAccepted: false,
      password: "", confirmPassword: "",
    },
  });

  // Auto-fill logged-in user info
  useEffect(() => {
    if (user) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
      if (name && !form.getValues("clientName")) form.setValue("clientName", name);
      if (user.email && !form.getValues("email")) form.setValue("email", user.email);
      const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("").toUpperCase();
      if (initials && !form.getValues("clientInitials")) form.setValue("clientInitials", initials);
    }
  }, [user, form]);

  const bookingMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { password, confirmPassword, ...rest } = data;
      const payload = {
        ...rest,
        ...(isLoggedIn ? {} : { password, confirmPassword }),
        serviceType: pkg!.serviceType,
        packageType: "custom",
        hasPhotoPackage: true,
        hasVideoPackage: false,
        numberOfPeople: 1,
        transportationFee: 0,
        addons: [],
        totalPrice: pkg!.totalPrice,
        currency: pkg!.currency,
        customPackageId: pkg!.id,
        photographerId: photographerId || undefined,
      };
      const res = await apiRequest("POST", "/api/bookings", payload);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Booking failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "Booking confirmed!", description: "Redirecting to payment…" });
      navigate(`/payment?booking=${result.booking.id}&type=deposit`);
    },
    onError: (e: any) => {
      toast({ title: "Booking failed", description: e.message, variant: "destructive" });
    },
  });

  const sym = pkg?.currency === "JMD" ? "J$" : "$";
  const fmt = (cents: number) => `${sym}${(cents / 100).toLocaleString()}`;

  if (pkgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (pkgError || !pkg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
        <AlertTriangle size={48} className="text-yellow-500" />
        <h2 className="text-2xl font-bold">Package not found</h2>
        <p className="text-muted-foreground">This offer may have expired or been removed.</p>
      </div>
    );
  }

  const deposit = pkg.depositAmount > 0 ? pkg.depositAmount : Math.round(pkg.totalPrice * 0.5);
  const balance = pkg.totalPrice - deposit;
  const items = pkg.lineItems ?? [];

  return (
    <div className="py-20 bg-gradient-to-br from-primary/5 to-secondary/5 min-h-screen">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold font-serif mb-2 gradient-text">Book Your Session</h2>
          <p className="text-muted-foreground">Review your package and complete your booking below.</p>
        </div>

        {/* Package summary */}
        <Card className="mb-8 border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <Tag size={20} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Private Package</p>
                <h3 className="text-xl font-bold mt-0.5">{pkg.name}</h3>
                {pkg.description && <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>}
              </div>
            </div>

            {/* Line items */}
            {items.length > 0 && (
              <div className="border-t pt-4 mt-2 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">What's included</p>
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-primary shrink-0" />
                      <span>{it.name}</span>
                    </div>
                    <span className={it.price > 0 ? "font-medium" : "text-muted-foreground"}>
                      {it.price > 0 ? fmt(it.price) : "Included"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Price breakdown */}
            <div className="border-t mt-4 pt-4 space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-primary text-lg">{fmt(pkg.totalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Due now (deposit)</span>
                <span>{fmt(deposit)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Balance due after session</span>
                <span>{fmt(balance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking form */}
        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => bookingMutation.mutate(d))} className="space-y-5">

                {/* Client info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="clientName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contactNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl><Input placeholder="+1 (876) 555-0000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="shootDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="shootTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time *</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="parish" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parish / Region *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="manchester-stelizabeth">Manchester & St. Elizabeth</SelectItem>
                          <SelectItem value="montegobay-negril-ochorios">Montego Bay, Negril & Ocho Rios</SelectItem>
                          <SelectItem value="other-parishes">All Other Parishes</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location / Venue *</FormLabel>
                    <FormControl><Input placeholder="e.g. Hellshire Beach, Kingston" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Account setup (new users only) */}
                {!isLoggedIn && (
                  <div className="border rounded-lg p-4 bg-muted/40 space-y-4">
                    <p className="text-sm font-medium">Create your account to track this booking</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password *</FormLabel>
                          <FormControl><Input type="password" placeholder="Min 6 characters" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password *</FormLabel>
                          <FormControl><Input type="password" placeholder="Repeat password" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}

                {/* Terms & Conditions */}
                <Card className="bg-muted">
                  <Collapsible open={isTermsOpen} onOpenChange={setIsTermsOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full p-6 justify-between text-left hover:bg-transparent">
                        <div className="flex items-center">
                          <Shield className="text-primary mr-3" size={20} />
                          <span className="font-semibold">Terms & Conditions</span>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${isTermsOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-6 pb-4">
                      <div className="space-y-3 max-h-64 overflow-y-auto bg-background p-4 rounded-lg text-sm">
                        <p className="text-muted-foreground leading-relaxed">{terms.header}</p>
                        {terms.sections.map((s, i) => (
                          <div key={i}>
                            <h5 className="font-semibold text-primary mb-1">{s.title}</h5>
                            <p className="text-muted-foreground text-xs">{s.content}</p>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="px-6 pb-6">
                    <FormField control={form.control} name="contractAccepted" render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-semibold cursor-pointer">
                            I have read and agree to the terms and conditions.
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )} />
                  </div>
                </Card>

                {/* Initials */}
                <FormField control={form.control} name="clientInitials" render={({ field }) => (
                  <FormItem className="max-w-[160px]">
                    <FormLabel>Client Initials *</FormLabel>
                    <FormControl>
                      <Input maxLength={5} placeholder="ABC" className="text-center font-bold" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-primary to-secondary text-white py-4 text-lg font-semibold"
                  disabled={bookingMutation.isPending}
                >
                  {bookingMutation.isPending ? "Processing…" : `Confirm Booking — ${fmt(deposit)} deposit`}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
