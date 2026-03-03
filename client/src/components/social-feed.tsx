import { useQuery } from "@tanstack/react-query";
import { Instagram, Twitter, Facebook, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

interface SocialConfig {
  twitterUsername: string | null;
  facebookPageUrl: string | null;
  tiktokUsername: string | null;
  instagramConfigured: boolean;
  instagramProfileUrl: string | null;
}

// ── Instagram Grid ────────────────────────────────────────────────────────────

function InstagramGrid({ profileUrl }: { profileUrl?: string | null }) {
  const { data, isLoading } = useQuery<{ media: InstagramMedia[]; configured: boolean }>({
    queryKey: ["/api/social/instagram"],
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!data?.configured) {
    return null;
  }

  const media = data.media.slice(0, 9);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Instagram className="h-5 w-5 text-pink-500" />
          <h3 className="text-lg font-semibold">Instagram</h3>
        </div>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-pink-500 hover:text-pink-600 transition-colors"
          >
            Follow us <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1 md:gap-2">
        {media.map((item) => {
          const src = item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url;
          return (
            <a
              key={item.id}
              href={item.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded bg-muted block"
            >
              {src ? (
                <img
                  src={src}
                  alt={item.caption?.slice(0, 80) || "Instagram post"}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Instagram className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              {item.media_type === "VIDEO" && (
                <div className="absolute top-2 right-2 bg-black/60 rounded px-1 text-white text-xs">▶</div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
            </a>
          );
        })}
      </div>
      {profileUrl && (
        <div className="mt-3 text-center">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-pink-500 flex items-center justify-center gap-1 transition-colors"
          >
            View all posts on Instagram <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Twitter / X Timeline ──────────────────────────────────────────────────────

function TwitterWidget({ username }: { username: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    // Dynamically load Twitter widget script
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    document.head.appendChild(script);
    return () => {
      try { document.head.removeChild(script); } catch (_) {}
    };
  }, [username]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Twitter className="h-5 w-5 text-sky-500" />
        <h3 className="text-lg font-semibold">Twitter / X</h3>
      </div>
      <div ref={ref} className="overflow-hidden rounded-lg border">
        <a
          className="twitter-timeline"
          data-height="400"
          data-theme="light"
          data-chrome="noheader nofooter noborders"
          href={`https://twitter.com/${username}`}
        >
          Tweets by @{username}
        </a>
      </div>
      <div className="mt-2 text-center">
        <a
          href={`https://twitter.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
        >
          Follow @{username} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ── Facebook Page Plugin ──────────────────────────────────────────────────────

function FacebookWidget({ pageUrl }: { pageUrl: string }) {
  const encodedUrl = encodeURIComponent(pageUrl);
  const iframeUrl = `https://www.facebook.com/plugins/page.php?href=${encodedUrl}&tabs=timeline&width=340&height=400&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false&appId`;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Facebook className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Facebook</h3>
      </div>
      <div className="overflow-hidden rounded-lg border bg-white" style={{ minHeight: 400 }}>
        <iframe
          src={iframeUrl}
          width="100%"
          height="400"
          style={{ border: "none", overflow: "hidden" }}
          scrolling="no"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          title="Facebook Page"
        />
      </div>
      <div className="mt-2 text-center">
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-1"
        >
          Visit our Facebook Page <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ── TikTok Widget ─────────────────────────────────────────────────────────────

function TikTokWidget({ username }: { username: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {/* TikTok icon — using a simple SVG since lucide doesn't have one */}
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.52V6.9a4.85 4.85 0 01-1.01-.21z" />
        </svg>
        <h3 className="text-lg font-semibold">TikTok</h3>
      </div>
      <div className="rounded-lg border p-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 flex items-center justify-center">
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.52V6.9a4.85 4.85 0 01-1.01-.21z" />
            </svg>
          </div>
        </div>
        <div>
          <p className="font-semibold text-lg">@{username}</p>
          <p className="text-muted-foreground text-sm mt-1">Follow us on TikTok for behind-the-scenes content</p>
        </div>
        <a
          href={`https://www.tiktok.com/@${username}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="bg-black hover:bg-black/80 text-white gap-2">
            <ExternalLink className="h-4 w-4" />
            View on TikTok
          </Button>
        </a>
      </div>
    </div>
  );
}

// ── Main SocialFeed Component ─────────────────────────────────────────────────

export function SocialFeed() {
  const { data: config } = useQuery<SocialConfig>({
    queryKey: ["/api/social/config"],
    staleTime: 10 * 60 * 1000,
  });

  const hasInstagram = config?.instagramConfigured;
  const hasTwitter = Boolean(config?.twitterUsername);
  const hasFacebook = Boolean(config?.facebookPageUrl);
  const hasTikTok = Boolean(config?.tiktokUsername);
  const hasAnySocial = hasInstagram || hasTwitter || hasFacebook || hasTikTok;

  if (!hasAnySocial) return null;

  return (
    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold gradient-text font-serif mb-4">
            Follow Our Journey
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Stay connected for behind-the-scenes moments, photography tips, and inspiration across our social channels.
          </p>
        </div>

        {/* Instagram takes full width if present */}
        {hasInstagram && (
          <div className="mb-12">
            <InstagramGrid profileUrl={config?.instagramProfileUrl} />
          </div>
        )}

        {/* Twitter, Facebook, TikTok in a responsive grid */}
        {(hasTwitter || hasFacebook || hasTikTok) && (
          <div className={`grid gap-8 ${[hasTwitter, hasFacebook, hasTikTok].filter(Boolean).length === 1 ? "grid-cols-1 max-w-md mx-auto" : [hasTwitter, hasFacebook, hasTikTok].filter(Boolean).length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
            {hasTwitter && <TwitterWidget username={config!.twitterUsername!} />}
            {hasFacebook && <FacebookWidget pageUrl={config!.facebookPageUrl!} />}
            {hasTikTok && <TikTokWidget username={config!.tiktokUsername!} />}
          </div>
        )}
      </div>
    </section>
  );
}
