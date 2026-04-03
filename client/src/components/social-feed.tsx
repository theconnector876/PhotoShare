import { useQuery } from "@tanstack/react-query";
import { InstagramLogo, TwitterLogo, FacebookLogo, ArrowSquareOut } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SocialConfig {
  twitterUsername: string | null;
  facebookPageUrl: string | null;
  tiktokUsername: string | null;
  instagramEmbedUrl: string | null;
  instagramProfileUrl: string | null;
}

// ── Behold.so Instagram Embed ─────────────────────────────────────────────────
// Behold provides a script-based embed. We inject it dynamically.

function BeholdFeed({ feedUrl, profileUrl }: { feedUrl: string; profileUrl?: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract feed ID from URL like https://feeds.behold.so/FEEDID
  const feedId = feedUrl.replace(/^https?:\/\/feeds\.behold\.so\//, "").replace(/\/$/, "");
  const widgetId = `beholdWidget-${feedId}`;

  useEffect(() => {
    if (!containerRef.current) return;
    // Remove any existing Behold script for this feed
    const existing = document.getElementById(`behold-script-${feedId}`);
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = `behold-script-${feedId}`;
    script.src = `https://feeds.behold.so/${feedId}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      try { document.body.removeChild(script); } catch (_) {}
    };
  }, [feedId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <InstagramLogo size={20} className="text-pink-500" />
          <h3 className="text-lg font-semibold">Instagram</h3>
        </div>
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-pink-500 hover:text-pink-600 transition-colors"
          >
            Follow us <ArrowSquareOut size={14} />
          </a>
        )}
      </div>

      {/* Behold widget container */}
      <div ref={containerRef}>
        <div id={widgetId} />
      </div>

      {profileUrl && (
        <div className="mt-3 text-center">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-pink-500 flex items-center justify-center gap-1 transition-colors"
          >
            View all posts on Instagram <ArrowSquareOut size={12} />
          </a>
        </div>
      )}
    </div>
  );
}

// ── Instagram profile-only card (no embed, just a follow CTA) ─────────────────

function InstagramProfileCard({ profileUrl }: { profileUrl: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <InstagramLogo size={20} className="text-pink-500" />
        <h3 className="text-lg font-semibold">Instagram</h3>
      </div>
      <div className="rounded-lg border p-6 text-center space-y-4 bg-gradient-to-br from-pink-50 to-orange-50 dark:from-pink-950/20 dark:to-orange-950/20">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-400 flex items-center justify-center">
            <InstagramLogo size={40} className="text-white" />
          </div>
        </div>
        <p className="text-muted-foreground text-sm">Follow us on Instagram for behind-the-scenes content, photography inspiration, and more.</p>
        <a href={profileUrl} target="_blank" rel="noopener noreferrer">
          <Button className="bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white gap-2">
            <InstagramLogo size={16} />
            Follow on Instagram
          </Button>
        </a>
      </div>
    </div>
  );
}

// ── Twitter / X Timeline ──────────────────────────────────────────────────────

function TwitterWidget({ username }: { username: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
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
        <TwitterLogo size={20} className="text-sky-500" />
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
          Follow @{username} <ArrowSquareOut size={12} />
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
        <FacebookLogo size={20} className="text-blue-600" />
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
          Visit our Facebook Page <ArrowSquareOut size={12} />
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
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.52V6.9a4.85 4.85 0 01-1.01-.21z" />
        </svg>
        <h3 className="text-lg font-semibold">TikTok</h3>
      </div>
      <div className="rounded-lg border p-6 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 flex items-center justify-center">
            <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.82a8.18 8.18 0 004.78 1.52V6.9a4.85 4.85 0 01-1.01-.21z" />
            </svg>
          </div>
        </div>
        <div>
          <p className="font-semibold text-lg">@{username}</p>
          <p className="text-muted-foreground text-sm mt-1">Follow us on TikTok for behind-the-scenes content</p>
        </div>
        <a href={`https://www.tiktok.com/@${username}`} target="_blank" rel="noopener noreferrer">
          <Button className="bg-black hover:bg-black/80 text-white gap-2">
            <ArrowSquareOut size={16} />
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

  const hasInstagramEmbed = Boolean(config?.instagramEmbedUrl);
  const hasInstagramProfile = Boolean(config?.instagramProfileUrl);
  const hasInstagram = hasInstagramEmbed || hasInstagramProfile;
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

        {/* Instagram — Behold embed if URL is set, otherwise profile card */}
        {hasInstagram && (
          <div className="mb-12">
            {hasInstagramEmbed ? (
              <BeholdFeed feedUrl={config!.instagramEmbedUrl!} profileUrl={config?.instagramProfileUrl} />
            ) : (
              <InstagramProfileCard profileUrl={config!.instagramProfileUrl!} />
            )}
          </div>
        )}

        {/* Twitter, Facebook, TikTok */}
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
