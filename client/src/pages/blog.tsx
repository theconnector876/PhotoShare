import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarBlank, Tag, ArrowRight, BookOpen } from "@phosphor-icons/react";
import { SocialFeed } from "@/components/social-feed";
import { useSiteConfig } from "@/context/site-config";
import { useState } from "react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  status: string;
  tags: string[] | null;
  publishedAt: string | null;
  createdAt: string;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function Blog() {
  const { config } = useSiteConfig();
  const [page, setPage] = useState(1);
  const limit = 9;

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog", { page, limit }],
    queryFn: async () => {
      const res = await fetch(`/api/blog?page=${page}&limit=${limit}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch posts");
      return res.json();
    },
  });

  const appName = config.branding.appName || "ConnectAGrapher";

  return (
    <>
      <Helmet>
        <title>Blog & Inspiration | {appName}</title>
        <meta name="description" content={`Photography tips, inspiration, and behind-the-scenes stories from ${appName}. Learn about wedding photography, portraits, and more.`} />
        <link rel="canonical" href="https://www.connectagrapher.com/blog" />
        <meta property="og:title" content={`Blog & Inspiration | ${appName}`} />
        <meta property="og:description" content={`Photography tips, inspiration, and behind-the-scenes stories from ${appName}.`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.connectagrapher.com/blog" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Blog & Inspiration | ${appName}`} />
        <meta name="twitter:description" content={`Photography tips, inspiration, and behind-the-scenes stories from ${appName}.`} />
      </Helmet>

      <div className="relative z-10 pt-16">
        {/* Hero */}
        <section className="py-20 bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <BookOpen size={32} className="text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-serif gradient-text mb-4">
              Blog & Inspiration
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Photography tips, behind-the-scenes moments, and stories from our lens. Stay inspired and learn how to capture life's most beautiful chapters.
            </p>
          </div>
        </section>

        {/* Blog Posts Grid */}
        <section className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-muted animate-pulse h-80" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen size={48} className="text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Coming Soon</h2>
                <p className="text-muted-foreground">We're working on some great content. Check back soon!</p>
                <div className="mt-6">
                  <Link href="/">
                    <Button variant="outline">Back to Home</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {posts.map((post, idx) => (
                    <Link key={post.id} href={`/blog/${post.slug}`}>
                      <Card className={`group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer h-full ${idx === 0 && page === 1 ? "md:col-span-2 lg:col-span-1" : ""}`}>
                        {post.coverImage ? (
                          <div className="relative h-56 overflow-hidden">
                            <img
                              src={post.coverImage}
                              alt={post.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                        ) : (
                          <div className="h-56 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <BookOpen size={48} className="text-primary/40" />
                          </div>
                        )}
                        <CardContent className="p-5 flex flex-col gap-3 flex-1">
                          {post.tags && post.tags.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {post.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  <Tag size={10} className="mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <h2 className="font-bold text-lg leading-snug group-hover:text-primary transition-colors duration-200 line-clamp-2">
                            {post.title}
                          </h2>
                          {post.excerpt && (
                            <p className="text-muted-foreground text-sm line-clamp-3 flex-1">{post.excerpt}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2 border-t">
                            <span className="flex items-center gap-1">
                              <CalendarBlank size={12} />
                              {formatDate(post.publishedAt || post.createdAt)}
                            </span>
                            <span className="flex items-center gap-1 text-primary font-medium group-hover:gap-2 transition-all duration-200">
                              Read more <ArrowRight size={12} />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex justify-center gap-4 mt-12">
                  {page > 1 && (
                    <Button variant="outline" onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                  )}
                  {posts.length === limit && (
                    <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                      Next Page
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Social Media Feed */}
        <div className="bg-muted/20">
          <SocialFeed />
        </div>

        {/* CTA */}
        <section className="py-16 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold font-serif mb-4 gradient-text">
              Ready to Book Your Session?
            </h2>
            <p className="text-muted-foreground mb-8">
              Turn your special moments into timeless photographs. Let's create something beautiful together.
            </p>
            <Link href="/booking">
              <Button className="px-8 py-4 text-lg magnetic-btn animate-glow bg-primary hover:bg-primary/90">
                Book a Session
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
