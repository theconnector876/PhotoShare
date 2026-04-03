import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Helmet } from "react-helmet-async";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarBlank, Tag, ArrowLeft, ShareNetwork, TwitterLogo, FacebookLogo, Link as LinkIcon } from "@phosphor-icons/react";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useSiteConfig } from "@/context/site-config";
import { useToast } from "@/hooks/use-toast";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  tags: string[] | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function readingTime(html: string) {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { config } = useSiteConfig();
  const { toast } = useToast();
  const appName = config.branding.appName || "ConnectAGrapher";

  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: [`/api/blog/${slug}`],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${slug}`, { credentials: "include" });
      if (!res.ok) throw new Error("Post not found");
      return res.json();
    },
    enabled: Boolean(slug),
  });

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(pageUrl).then(() => {
      toast({ title: "Link copied!" });
    });
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(post?.title || "");
    const url = encodeURIComponent(pageUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(pageUrl);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="relative z-10 pt-24 px-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-8 w-24 bg-muted animate-pulse rounded" />
          <div className="h-12 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded" />
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-4 bg-muted animate-pulse rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="relative z-10 pt-24 px-4 text-center">
        <Helmet><title>Post Not Found | {appName}</title></Helmet>
        <h1 className="text-3xl font-bold mb-4">Post Not Found</h1>
        <p className="text-muted-foreground mb-6">This post doesn't exist or has been removed.</p>
        <Link href="/blog">
          <Button variant="outline">
            <ArrowLeft size={16} className="mr-2" />
            Back to Blog
          </Button>
        </Link>
      </div>
    );
  }

  const seoTitle = post.seoTitle || `${post.title} | ${appName}`;
  const seoDesc = post.seoDescription || post.excerpt || `Read ${post.title} on the ${appName} blog.`;

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <link rel="canonical" href={pageUrl} />
        {/* Open Graph */}
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:site_name" content={appName} />
        {post.coverImage && <meta property="og:image" content={post.coverImage} />}
        {post.coverImage && <meta property="og:image:width" content="1200" />}
        {post.coverImage && <meta property="og:image:height" content="630" />}
        <meta property="article:published_time" content={post.publishedAt || post.createdAt} />
        {post.tags?.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        {/* Twitter / X card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDesc} />
        {post.coverImage && <meta name="twitter:image" content={post.coverImage} />}
        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: seoDesc,
          datePublished: post.publishedAt || post.createdAt,
          dateModified: post.publishedAt || post.createdAt,
          image: post.coverImage,
          url: pageUrl,
          publisher: {
            "@type": "Organization",
            name: appName,
            logo: { "@type": "ImageObject", url: "https://www.connectagrapher.com/logo.png" },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
        })}</script>
      </Helmet>

      <div className="relative z-10 pt-20">
        {/* Back navigation */}
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-2">
          <Link href="/blog">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft size={16} />
              Blog
            </Button>
          </Link>
        </div>

        {/* Cover Image */}
        {post.coverImage && (
          <div className="max-w-4xl mx-auto px-4 mb-8">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full max-h-[480px] object-cover rounded-xl shadow-lg"
            />
          </div>
        )}

        {/* Article */}
        <article className="max-w-3xl mx-auto px-4 pb-20">
          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  <Tag size={12} className="mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-bold font-serif mb-4 leading-tight">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground border-b pb-6 mb-8 flex-wrap">
            <span className="flex items-center gap-1.5">
              <CalendarBlank size={14} />
              {formatDate(post.publishedAt || post.createdAt)}
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span>{readingTime(post.content)} min read</span>
            <span className="text-muted-foreground/40">|</span>
            <span>{appName}</span>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-a:text-primary prose-img:rounded-lg prose-blockquote:border-primary">
            <div dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>

          {/* Share */}
          <div className="mt-12 pt-8 border-t">
            <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <ShareNetwork size={16} />
              Share this post
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={shareOnTwitter} className="gap-2">
                <TwitterLogo size={16} className="text-sky-500" />
                Twitter
              </Button>
              <Button variant="outline" size="sm" onClick={shareOnFacebook} className="gap-2">
                <FacebookLogo size={16} className="text-blue-600" />
                Facebook
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
                <LinkIcon size={16} />
                Copy Link
              </Button>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold font-serif mb-2">Ready to Book Your Session?</h2>
            <p className="text-muted-foreground mb-4">
              Let's capture your story. Book a photography session with us today.
            </p>
            <Link href="/booking">
              <Button className="bg-primary hover:bg-primary/90 magnetic-btn">
                Book Now
              </Button>
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
