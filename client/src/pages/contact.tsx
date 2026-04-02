import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, MapPin, Instagram, Facebook, Twitter, ExternalLink } from "lucide-react";

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function Contact() {
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return apiRequest('POST', '/api/contact', data);
    },
    onSuccess: () => {
      toast({
        title: "Message Sent!",
        description: "We'll get back to you within 24 hours.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/contact'] });
    },
    onError: () => {
      toast({
        title: "Send Failed",
        description: "There was an error sending your message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    sendMessageMutation.mutate(data);
  };

  const { data: socialConfig } = useQuery<{
    twitterUsername: string | null;
    facebookPageUrl: string | null;
    tiktokUsername: string | null;
    instagramEmbedUrl: string | null;
    instagramProfileUrl: string | null;
  }>({
    queryKey: ["/api/social/config"],
    staleTime: 10 * 60 * 1000,
  });

  // TikTok SVG path (lucide doesn't include it)
  const TikTokIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.52V6.9a4.85 4.85 0 01-1.01-.21z" />
    </svg>
  );

  const socialLinks = [
    {
      icon: Instagram,
      label: "Instagram",
      href: socialConfig?.instagramProfileUrl || (socialConfig?.instagramEmbedUrl ? "https://www.instagram.com" : null),
      gradient: "from-pink-500 via-red-500 to-orange-400",
      testId: "social-instagram",
    },
    {
      icon: Facebook,
      label: "Facebook",
      href: socialConfig?.facebookPageUrl || null,
      gradient: "from-blue-600 to-blue-500",
      testId: "social-facebook",
    },
    {
      icon: Twitter,
      label: "Twitter / X",
      href: socialConfig?.twitterUsername ? `https://twitter.com/${socialConfig.twitterUsername}` : null,
      gradient: "from-sky-400 to-blue-500",
      testId: "social-twitter",
    },
    {
      icon: TikTokIcon,
      label: "TikTok",
      href: socialConfig?.tiktokUsername ? `https://www.tiktok.com/@${socialConfig.tiktokUsername}` : null,
      gradient: "from-gray-900 to-gray-700",
      testId: "social-tiktok",
    },
  ].filter((s) => s.href);

  return (
    <div className="pt-20 pb-20 relative z-10">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4 gradient-text slide-in-up" data-testid="contact-title">Get In Touch</h1>
          <p className="text-lg text-muted-foreground slide-in-up stagger-1">
            Ready to create something beautiful together?
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-8 slide-in-up stagger-2">
            <Card className="p-6 hover-3d" data-testid="contact-phone">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/25 rounded-2xl flex items-center justify-center">
                  <Phone className="text-amber-400 w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Phone</h4>
                  <p className="text-muted-foreground">18763881801</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover-3d" data-testid="contact-email">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500/15 border border-blue-500/25 rounded-2xl flex items-center justify-center">
                  <Mail className="text-blue-400 w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Email</h4>
                  <p className="text-muted-foreground">support@connectagrapher.com</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover-3d" data-testid="contact-location">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-rose-500/15 border border-rose-500/25 rounded-2xl flex items-center justify-center">
                  <MapPin className="text-rose-400 w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Location</h4>
                  <p className="text-muted-foreground">New Forest District, Manchester, Jamaica</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover-3d" data-testid="contact-social">
              <h4 className="font-semibold mb-4">Follow Our Work</h4>
              {socialLinks.length > 0 ? (
                <div className="flex space-x-4">
                  {socialLinks.map(({ icon: Icon, label, href, gradient, testId }) => (
                    <a
                      key={testId}
                      href={href!}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={label}
                      className={`w-10 h-10 bg-gradient-to-r ${gradient} rounded-full flex items-center justify-center text-white magnetic-btn transition-transform hover:scale-110`}
                      data-testid={testId}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="flex space-x-4">
                  <a href="#" className="w-10 h-10 bg-pink-500/15 border border-pink-500/25 rounded-full flex items-center justify-center text-pink-400 magnetic-btn hover:bg-pink-500/25 transition-colors" data-testid="social-instagram">
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a href="#" className="w-10 h-10 bg-blue-500/15 border border-blue-500/25 rounded-full flex items-center justify-center text-blue-400 magnetic-btn hover:bg-blue-500/25 transition-colors" data-testid="social-facebook">
                    <Facebook className="w-5 h-5" />
                  </a>
                  <a href="#" className="w-10 h-10 bg-sky-500/15 border border-sky-500/25 rounded-full flex items-center justify-center text-sky-400 magnetic-btn hover:bg-sky-500/25 transition-colors" data-testid="social-twitter">
                    <Twitter className="w-5 h-5" />
                  </a>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-8 hover-3d slide-in-up stagger-3">
            <h3 className="text-2xl font-bold mb-6" data-testid="contact-form-title">Send a Message</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input 
                          className="form-focus" 
                          data-testid="input-contact-name"
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          className="form-focus" 
                          data-testid="input-contact-email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          rows={5}
                          className="form-focus" 
                          data-testid="textarea-contact-message"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-semibold magnetic-btn"
                  disabled={sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <i className="fas fa-paper-plane mr-2"></i>
                  {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </Form>
          </Card>
        </div>

        {/* Additional Information */}
        <div className="mt-20 text-center">
          <Card className="p-8 bg-amber-500/5 border-amber-500/20 hover-3d slide-in-up">
            <h3 className="text-2xl font-bold mb-4 gradient-text" data-testid="response-time-title">Response Time</h3>
            <p className="text-lg text-muted-foreground mb-6">
              We typically respond to all inquiries within 24 hours. For urgent bookings or questions, feel free to call us directly at the number provided above.
            </p>
            <p className="text-sm text-muted-foreground">
              Business Hours: Monday - Saturday, 9:00 AM - 7:00 PM (Jamaica Standard Time)
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
