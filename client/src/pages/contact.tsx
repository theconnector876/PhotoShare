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
import { Phone, EnvelopeSimple, MapPin, InstagramLogo, FacebookLogo, TwitterLogo, PaperPlaneTilt, Clock } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { ScrollReveal, StaggerReveal, RevealItem } from "@/components/scroll-reveal";

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
    defaultValues: { name: "", email: "", message: "" },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return apiRequest('POST', '/api/contact', data);
    },
    onSuccess: () => {
      toast({ title: "Message Sent!", description: "We'll get back to you within 24 hours." });
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

  const TikTokIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.52V6.9a4.85 4.85 0 01-1.01-.21z" />
    </svg>
  );

  const socialLinks = [
    {
      icon: InstagramLogo,
      label: "Instagram",
      href: socialConfig?.instagramProfileUrl || (socialConfig?.instagramEmbedUrl ? "https://www.instagram.com" : null),
      color: "text-pink-400",
      testId: "social-instagram",
    },
    {
      icon: FacebookLogo,
      label: "Facebook",
      href: socialConfig?.facebookPageUrl || null,
      color: "text-blue-400",
      testId: "social-facebook",
    },
    {
      icon: TwitterLogo,
      label: "Twitter / X",
      href: socialConfig?.twitterUsername ? `https://twitter.com/${socialConfig.twitterUsername}` : null,
      color: "text-sky-400",
      testId: "social-twitter",
    },
    {
      icon: TikTokIcon,
      label: "TikTok",
      href: socialConfig?.tiktokUsername ? `https://www.tiktok.com/@${socialConfig.tiktokUsername}` : null,
      color: "text-white/60",
      testId: "social-tiktok",
    },
  ].filter((s) => s.href);

  const contactInfo = [
    {
      icon: Phone,
      label: "Phone",
      value: "18763881801",
      color: "bg-amber-500/10 border-amber-500/20",
      iconColor: "text-amber-400",
      testId: "contact-phone",
    },
    {
      icon: EnvelopeSimple,
      label: "Email",
      value: "support@connectagrapher.com",
      color: "bg-blue-500/10 border-blue-500/20",
      iconColor: "text-blue-400",
      testId: "contact-email",
    },
    {
      icon: MapPin,
      label: "Location",
      value: "New Forest District, Manchester, Jamaica",
      color: "bg-rose-500/10 border-rose-500/20",
      iconColor: "text-rose-400",
      testId: "contact-location",
    },
  ];

  return (
    <div className="pt-24 pb-24 relative z-10 overflow-hidden">
      {/* Hero heading */}
      <div className="max-w-6xl mx-auto px-4 mb-16">
        <ScrollReveal variant="fade-up">
          <p className="eyebrow mb-4">Get In Touch</p>
          <div className="relative inline-block">
            <h1
              className="font-extrabold text-foreground tracking-tight leading-[1.02]"
              style={{ fontFamily: 'var(--font-display, var(--font-serif))', fontSize: 'clamp(2.4rem, 7vw, 5rem)' }}
              data-testid="contact-title"
            >
              Let&apos;s Create{' '}
              <span className="relative">
                <span className="gradient-text">Together</span>
                {/* Amber underline decoration */}
                <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-400 rounded-full" />
              </span>
            </h1>
          </div>
          <p className="text-muted-foreground text-[16px] mt-4 max-w-md">
            Ready to create something beautiful? Reach out and let&apos;s talk about your vision.
          </p>
        </ScrollReveal>
      </div>

      {/* Main split */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid lg:grid-cols-5 gap-10 lg:gap-16">

          {/* LEFT — contact info (60%) */}
          <div className="lg:col-span-3 space-y-6">
            <ScrollReveal variant="slide-left" delay={0.05}>
              <p className="eyebrow mb-4">Contact Info</p>
            </ScrollReveal>

            <StaggerReveal className="space-y-4">
              {contactInfo.map(({ icon: Icon, label, value, color, iconColor, testId }) => (
                <RevealItem key={testId} variant="slide-left">
                  <motion.div
                    className="flex items-center gap-4 p-5 rounded-2xl bg-card border border-border"
                    whileHover={{ x: 4, borderColor: 'rgba(245,158,11,0.3)' }}
                    transition={{ duration: 0.2 }}
                    data-testid={testId}
                  >
                    <div className={`w-12 h-12 ${color} border rounded-2xl flex items-center justify-center shrink-0`}>
                      <Icon size={20} className={`${iconColor}`} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-muted-foreground/60 mb-0.5">{label}</p>
                      <p className="text-foreground font-medium text-[15px]">{value}</p>
                    </div>
                  </motion.div>
                </RevealItem>
              ))}
            </StaggerReveal>

            {/* Social links */}
            <ScrollReveal variant="fade-up" delay={0.25}>
              <div className="pt-2" data-testid="contact-social">
                <p className="eyebrow mb-4">Follow Our Work</p>
                <div className="flex flex-wrap gap-3">
                  {socialLinks.length > 0 ? (
                    socialLinks.map(({ icon: Icon, label, href, color, testId }) => (
                      <a
                        key={testId}
                        href={href!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-amber-500/30 transition-all text-[13px] font-medium text-muted-foreground hover:text-foreground group"
                        data-testid={testId}
                      >
                        <span className={`${color} group-hover:scale-110 transition-transform`}>
                          <Icon size={16} />
                        </span>
                        {label}
                      </a>
                    ))
                  ) : (
                    <div className="flex gap-3">
                      <a href="#" className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-amber-500/30 transition-all text-[13px] font-medium text-muted-foreground" data-testid="social-instagram">
                        <InstagramLogo size={16} className="text-pink-400" /> Instagram
                      </a>
                      <a href="#" className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-amber-500/30 transition-all text-[13px] font-medium text-muted-foreground" data-testid="social-facebook">
                        <FacebookLogo size={16} className="text-blue-400" /> Facebook
                      </a>
                      <a href="#" className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-amber-500/30 transition-all text-[13px] font-medium text-muted-foreground" data-testid="social-twitter">
                        <TwitterLogo size={16} className="text-sky-400" /> Twitter
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* RIGHT — form (40%) */}
          <ScrollReveal variant="slide-right" delay={0.1} className="lg:col-span-2">
            <div className="card-premium p-7 shadow-xl shadow-black/5 dark:shadow-black/30">
              <h3 className="font-bold text-[20px] mb-1 text-foreground" data-testid="contact-form-title">Send a Message</h3>
              <p className="text-muted-foreground text-[13px] mb-6">We'll get back to you within 24 hours.</p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Name</FormLabel>
                        <FormControl>
                          <Input
                            className="form-focus rounded-xl border-border bg-muted/40 focus:bg-background transition-colors"
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
                        <FormLabel className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            className="form-focus rounded-xl border-border bg-muted/40 focus:bg-background transition-colors"
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
                        <FormLabel className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">Message</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={5}
                            className="form-focus rounded-xl border-border bg-muted/40 focus:bg-background transition-colors resize-none"
                            data-testid="textarea-contact-message"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      type="submit"
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-[14px] shadow-lg shadow-amber-500/20 transition-all"
                      disabled={sendMessageMutation.isPending}
                      data-testid="button-send-message"
                    >
                      <PaperPlaneTilt size={16} className="mr-2" />
                      {sendMessageMutation.isPending ? 'Sending...' : 'Send Message'}
                    </Button>
                  </motion.div>
                </form>
              </Form>
            </div>
          </ScrollReveal>
        </div>

        {/* Bottom band — hours */}
        <ScrollReveal variant="fade-up" delay={0.15} className="mt-14">
          <div className="bg-[#070709] rounded-2xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4" data-testid="response-time-title">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Clock size={20} className="text-amber-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-[15px]">Response Time</p>
                <p className="text-white/40 text-[13px]">We typically respond within 24 hours</p>
              </div>
            </div>
            <div className="h-px md:h-10 w-full md:w-px bg-white/[0.06]" />
            <div className="text-center md:text-right">
              <p className="text-white/60 text-[13px]">Business Hours</p>
              <p className="text-white font-semibold text-[14px]">Mon – Sat, 9:00 AM – 7:00 PM</p>
              <p className="text-white/40 text-[12px]">Jamaica Standard Time</p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
