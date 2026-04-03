import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Plus as PlusIcon, PencilSimple as EditIcon, Trash, Globe, EyeSlash as EyeOff, ArrowSquareOut as ExternalLink, CircleNotch as Loader2, InstagramLogo as Instagram, TwitterLogo as Twitter, FacebookLogo as Facebook } from "@phosphor-icons/react";
import { isUnauthorizedError } from "@/lib/authUtils";

// ── Cloudinary upload helper (same pattern as admin-catalogues) ───────────────

async function uploadBlogImage(file: File): Promise<string> {
  const sigRes = await fetch("/api/admin/upload-signature", { method: "POST", credentials: "include" });
  if (!sigRes.ok) throw new Error("Failed to get upload signature");
  const { cloudName, apiKey, timestamp, signature } = await sigRes.json();
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", apiKey);
  fd.append("timestamp", String(timestamp));
  fd.append("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.secure_url as string;
}

// ── Slug generation ───────────────────────────────────────────────────────────

function toSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  status: string;
  tags: string[] | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Form Schema ───────────────────────────────────────────────────────────────

const blogFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().max(500).optional().or(z.literal("")),
  coverImage: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  status: z.enum(["draft", "published"]),
  tags: z.string().optional(), // comma-separated
  seoTitle: z.string().max(200).optional().or(z.literal("")),
  seoDescription: z.string().max(300).optional().or(z.literal("")),
});

type BlogFormData = z.infer<typeof blogFormSchema>;

// ── Social Config Form ────────────────────────────────────────────────────────

const socialFormSchema = z.object({
  instagramEmbedUrl: z.string().optional().or(z.literal("")),
  instagramProfileUrl: z.string().optional().or(z.literal("")),
  twitterUsername: z.string().optional().or(z.literal("")),
  facebookPageUrl: z.string().optional().or(z.literal("")),
  tiktokUsername: z.string().optional().or(z.literal("")),
});

type SocialFormData = z.infer<typeof socialFormSchema>;

function SocialConfigPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config } = useQuery<{
    twitterUsername: string | null;
    facebookPageUrl: string | null;
    tiktokUsername: string | null;
    instagramEmbedUrl: string | null;
    instagramProfileUrl: string | null;
  }>({
    queryKey: ["/api/social/config"],
  });

  const form = useForm<SocialFormData>({
    resolver: zodResolver(socialFormSchema),
    defaultValues: {
      instagramEmbedUrl: "",
      instagramProfileUrl: "",
      twitterUsername: "",
      facebookPageUrl: "",
      tiktokUsername: "",
    },
    values: {
      instagramEmbedUrl: config?.instagramEmbedUrl || "",
      instagramProfileUrl: config?.instagramProfileUrl || "",
      twitterUsername: config?.twitterUsername || "",
      facebookPageUrl: config?.facebookPageUrl || "",
      tiktokUsername: config?.tiktokUsername || "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: SocialFormData) => {
      return apiRequest("PUT", "/api/admin/social-config", {
        instagramEmbedUrl: data.instagramEmbedUrl || undefined,
        instagramProfileUrl: data.instagramProfileUrl || undefined,
        twitterUsername: data.twitterUsername || undefined,
        facebookPageUrl: data.facebookPageUrl || undefined,
        tiktokUsername: data.tiktokUsername || undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Social config saved" });
      qc.invalidateQueries({ queryKey: ["/api/social/config"] });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-pink-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-lg p-4 text-sm text-pink-800 dark:text-pink-200">
        <p className="font-semibold mb-2 flex items-center gap-2">
          <Instagram size={16} /> Instagram — Easy setup via Behold.so (free, no developer account needed)
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Go to <a href="https://behold.so" target="_blank" rel="noopener noreferrer" className="underline font-medium">behold.so</a> and sign up for free</li>
          <li>Click <strong>New Feed</strong> and connect your Instagram account (just log in — no developer app)</li>
          <li>Once created, copy the <strong>Feed URL</strong> — it looks like <code className="bg-pink-100 dark:bg-pink-900 px-1 rounded">https://feeds.behold.so/XXXXXXXX</code></li>
          <li>Paste it into the <strong>Behold Feed URL</strong> field below and save</li>
        </ol>
        <p className="mt-2 text-xs opacity-75">Free tier: 1 feed, auto-updates when you post on Instagram ✓</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="instagramEmbedUrl"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel className="flex items-center gap-2">
                    <Instagram size={16} className="text-pink-500" />
                    Behold Feed URL
                    {config?.instagramEmbedUrl && <Badge className="bg-green-100 text-green-700 text-xs">Connected</Badge>}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://feeds.behold.so/XXXXXXXXXXXXXXXX" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Paste the feed URL from behold.so — your Instagram posts will appear automatically</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="instagramProfileUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Instagram size={16} className="text-pink-500" />
                    Instagram Profile URL
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://www.instagram.com/yourhandle" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Used for "Follow us" links across the site</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="twitterUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Twitter size={16} className="text-sky-500" />
                    Twitter / X Username (without @)
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. connectagrapher" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="facebookPageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Facebook size={16} className="text-blue-600" />
                    Facebook Page URL
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://facebook.com/yourpage" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tiktokUsername"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TikTok Username (without @)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. connectagrapher" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
            Save Social Config
          </Button>
        </form>
      </Form>
    </div>
  );
}

// ── Post Form Dialog ──────────────────────────────────────────────────────────

function BlogPostDialog({
  post,
  open,
  onOpenChange,
  onSaved,
}: {
  post?: BlogPost;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const form = useForm<BlogFormData>({
    resolver: zodResolver(blogFormSchema),
    defaultValues: {
      title: post?.title || "",
      slug: post?.slug || "",
      content: post?.content || "",
      excerpt: post?.excerpt || "",
      coverImage: post?.coverImage || "",
      status: (post?.status as "draft" | "published") || "draft",
      tags: post?.tags?.join(", ") || "",
      seoTitle: post?.seoTitle || "",
      seoDescription: post?.seoDescription || "",
    },
  });

  // Reset form when post changes
  const isEdit = Boolean(post);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    form.setValue("title", e.target.value);
    if (!isEdit) {
      form.setValue("slug", toSlug(e.target.value));
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadBlogImage(file);
      form.setValue("coverImage", url);
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: BlogFormData) => {
      const payload = {
        ...data,
        excerpt: data.excerpt || null,
        coverImage: data.coverImage || null,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };
      if (isEdit) {
        return apiRequest("PUT", `/api/admin/blog/${post!.id}`, payload);
      }
      return apiRequest("POST", "/api/admin/blog", payload);
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Post updated" : "Post created" });
      onSaved();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  const coverImage = form.watch("coverImage");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Post" : "New Blog Post"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => saveMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...form.register("title")}
                  onChange={handleTitleChange}
                  placeholder="Your post title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug (URL) *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="my-post-slug" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">connectagrapher.com/blog/{field.value}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cover Image */}
            <div>
              <Label>Cover Image</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  {...form.register("coverImage")}
                  placeholder="https://... or upload below"
                  className="flex-1"
                />
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" asChild disabled={uploading}>
                    <span>{uploading ? <Loader2 size={16} className="animate-spin" /> : "Upload"}</span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </label>
              </div>
              {coverImage && (
                <img src={coverImage} alt="Cover preview" className="mt-2 h-32 w-full object-cover rounded border" />
              )}
            </div>

            {/* Excerpt */}
            <FormField
              control={form.control}
              name="excerpt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Excerpt (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="Short summary shown in blog listing..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Content */}
            <div>
              <Label>Content *</Label>
              <div className="mt-1">
                <RichTextEditor
                  value={form.watch("content")}
                  onChange={(v) => form.setValue("content", v)}
                  placeholder="Write your blog post here..."
                />
              </div>
              {form.formState.errors.content && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.content.message}</p>
              )}
            </div>

            {/* Tags */}
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (comma-separated)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="wedding, photography, tips" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* SEO */}
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-medium">SEO Settings</p>
              <FormField
                control={form.control}
                name="seoTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SEO Title (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Defaults to post title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seoDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} placeholder="150–160 chars for search results" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
                {isEdit ? "Save Changes" : "Create Post"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main AdminBlog Component ──────────────────────────────────────────────────

export function AdminBlog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | undefined>();

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/admin/blog"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/blog/${id}`),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      qc.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      qc.invalidateQueries({ queryKey: ["/api/blog"] });
    },
    onError: (err: any) => {
      if (isUnauthorizedError(err)) return;
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingPost(undefined);
    setDialogOpen(true);
  };

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/blog"] });
    qc.invalidateQueries({ queryKey: ["/api/blog"] });
  };

  const published = posts.filter((p) => p.status === "published");
  const drafts = posts.filter((p) => p.status === "draft");

  return (
    <div className="space-y-6">
      <Tabs defaultValue="posts">
        <TabsList>
          <TabsTrigger value="posts">Posts ({posts.length})</TabsTrigger>
          <TabsTrigger value="social">Social Media</TabsTrigger>
        </TabsList>

        {/* ── Posts Tab ── */}
        <TabsContent value="posts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{published.length} published</span>
              <span>{drafts.length} drafts</span>
            </div>
            <Button onClick={handleNew}>
              <PlusIcon size={16} className="mr-2" />
              New Post
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium mb-2">No blog posts yet</p>
              <p className="text-sm mb-4">Create your first post to start attracting clients via SEO</p>
              <Button onClick={handleNew}>
                <PlusIcon size={16} className="mr-2" />
                Create First Post
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <Card key={post.id} className="flex gap-0">
                  <CardContent className="flex items-center gap-4 p-4 flex-1">
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-16 h-16 rounded object-cover shrink-0 hidden sm:block"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted shrink-0 hidden sm:block" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{post.title}</h3>
                        <Badge variant={post.status === "published" ? "default" : "secondary"}>
                          {post.status === "published" ? <Globe size={12} className="mr-1" /> : <EyeOff size={12} className="mr-1" />}
                          {post.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {post.excerpt || `/${post.slug}`}
                      </p>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {post.tags.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {post.status === "published" && (
                        <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" title="View live">
                            <ExternalLink size={16} />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(post)} title="Edit">
                        <EditIcon size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => {
                          if (confirm("Delete this post?")) deleteMutation.mutate(post.id);
                        }}
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Social Media Tab ── */}
        <TabsContent value="social">
          <SocialConfigPanel />
        </TabsContent>
      </Tabs>

      <BlogPostDialog
        post={editingPost}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}
