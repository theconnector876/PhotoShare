import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  ImageIcon, UploadIcon, Eye, X,
  ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  Clock, Loader2, Copy, ArrowUpDown, Download, GripVertical,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Gallery {
  id: string;
  bookingId: string | null;
  clientEmail: string;
  accessCode: string;
  galleryImages: string[];
  selectedImages: string[];
  finalImages: string[];
  status: string;
  galleryDownloadEnabled: boolean;
  selectedDownloadEnabled: boolean;
  finalDownloadEnabled: boolean;
  createdAt: string;
}

type ImageType = "gallery" | "selected" | "final";

interface SignedConfig {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
}

type FileStatus = "queued" | "uploading" | "done" | "error" | "duplicate";

interface FileItem {
  id: string;
  file: File;
  preview: string;
  status: FileStatus;
  progress: number;
  cloudUrl?: string;
  error?: string;
}

// ── Image compression ─────────────────────────────────────────────────────────

function compressImage(file: File, maxDimension = 4096, quality = 0.88): Promise<File> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width: w, height: h } = img;
      if (w > maxDimension || h > maxDimension) {
        if (w >= h) { h = Math.round((h / w) * maxDimension); w = maxDimension; }
        else        { w = Math.round((w / h) * maxDimension); h = maxDimension; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg", quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ── Cloudinary upload ─────────────────────────────────────────────────────────

function uploadWithProgress(file: File, config: SignedConfig, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 200) {
        try { resolve((JSON.parse(xhr.responseText) as { secure_url: string }).secure_url); }
        catch { reject(new Error("Bad response")); }
      } else {
        try { const e = JSON.parse(xhr.responseText) as { error?: { message?: string } }; reject(new Error(e?.error?.message || `Error ${xhr.status}`)); }
        catch { reject(new Error(`Upload failed (${xhr.status})`)); }
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", config.apiKey);
    fd.append("timestamp", String(config.timestamp));
    fd.append("signature", config.signature);
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`);
    xhr.send(fd);
  });
}

// ── Upload panel ──────────────────────────────────────────────────────────────

function FileCard({ item }: { item: FileItem }) {
  return (
    <div className="relative rounded-xl overflow-hidden aspect-square bg-green-100 shadow ring-1 ring-green-200">
      <img src={item.preview} alt={item.file.name} className="w-full h-full object-cover" />
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${
        item.status === "queued" ? "bg-black/30"
        : item.status === "uploading" ? "bg-black/25"
        : item.status === "done" ? "bg-green-700/65"
        : item.status === "duplicate" ? "bg-amber-500/80"
        : "bg-red-500/70"
      }`}>
        {item.status === "queued"    && <Clock className="w-6 h-6 text-white/80" />}
        {item.status === "uploading" && (
          <div className="flex flex-col items-center gap-1.5 px-3 w-full">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <div className="w-full bg-white/30 rounded-full h-1">
              <div className="bg-yellow-400 rounded-full h-1 transition-all" style={{ width: `${item.progress}%` }} />
            </div>
            <span className="text-white text-xs font-semibold">{item.progress}%</span>
          </div>
        )}
        {item.status === "done"      && <CheckCircle2 className="w-9 h-9 text-white drop-shadow-md" />}
        {item.status === "duplicate" && (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <Copy className="w-6 h-6 text-white" />
            <span className="text-white text-[10px] leading-tight font-semibold">Already in gallery</span>
          </div>
        )}
        {item.status === "error" && (
          <div className="flex flex-col items-center gap-1 px-2 text-center">
            <AlertCircle className="w-6 h-6 text-white" />
            <span className="text-white text-[10px] leading-tight">{item.error}</span>
          </div>
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-3 pb-1.5">
        <p className="text-white text-[10px] truncate font-medium">{item.file.name}</p>
      </div>
    </div>
  );
}

function UploadPanel({ items, onClose, canClose }: { items: FileItem[]; onClose: () => void; canClose: boolean }) {
  const done       = items.filter((i) => i.status === "done").length;
  const errors     = items.filter((i) => i.status === "error").length;
  const duplicates = items.filter((i) => i.status === "duplicate").length;
  const uploadable = items.filter((i) => i.status !== "duplicate");
  const total      = uploadable.length;
  const overallPct = total === 0 ? 100
    : Math.round(uploadable.reduce((s, i) => s + (i.status === "done" ? 100 : i.progress), 0) / total);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && canClose) onClose(); }}>
      <DialogContent className="max-w-lg w-[95vw] p-0 overflow-hidden rounded-2xl gap-0"
        onInteractOutside={(e) => { if (!canClose) e.preventDefault(); }}>
        <div className="bg-gradient-to-r from-green-800 to-green-700 px-5 py-4 text-white">
          <DialogTitle className="text-base font-semibold mb-1.5">
            {canClose
              ? `Done — ${done} saved${duplicates > 0 ? `, ${duplicates} skipped` : ""}${errors > 0 ? `, ${errors} failed` : ""}`
              : `Saving ${done} / ${total} photos…`}
          </DialogTitle>
          <div className="flex items-center gap-3">
            <Progress value={overallPct} className="flex-1 h-1.5 bg-white/20 [&>div]:bg-yellow-400 [&>div]:transition-all" />
            <span className="text-xs text-white/70 tabular-nums w-8 text-right">{overallPct}%</span>
          </div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-4 bg-green-50">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {items.map((item) => <FileCard key={item.id} item={item} />)}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-green-100 bg-white flex items-center justify-between gap-3">
          <p className="text-xs text-green-700 leading-snug">
            {canClose
              ? errors > 0 ? `${errors} photo${errors > 1 ? "s" : ""} could not be saved — please try again`
                : duplicates > 0 ? `${duplicates} duplicate${duplicates > 1 ? "s" : ""} skipped · all others saved`
                : "All photos saved to Connectagrapher"
              : "Saving photos to Connectagrapher…"}
          </p>
          <Button size="sm"
            className={canClose ? "bg-green-700 hover:bg-green-800 text-white shrink-0" : "shrink-0"}
            variant={canClose ? "default" : "outline"}
            onClick={onClose} disabled={!canClose}>
            {canClose ? "Done" : <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Uploading</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Image section (extracted outside AdminGalleries to avoid remount issues) ──
// Uses a native <label htmlFor> to trigger the file input — no programmatic
// .click() needed, which avoids browser user-gesture restrictions.

interface ImageSectionProps {
  gallery: Gallery;
  type: ImageType;
  sortOrder: string;
  onSortChange: (v: string) => void;
  dragSrc: { galleryId: string; type: ImageType; index: number } | null;
  dragOver: { galleryId: string; type: ImageType; index: number } | null;
  onDragStart: (galleryId: string, type: ImageType, index: number) => void;
  onDragOver: (e: React.DragEvent, galleryId: string, type: ImageType, index: number) => void;
  onDrop: (gallery: Gallery, type: ImageType, dropIndex: number) => void;
  onDragEnd: () => void;
  onRemove: (gallery: Gallery, type: ImageType, url: string) => void;
  onDedup: (gallery: Gallery, type: ImageType) => void;
  onFilesSelected: (files: File[], gallery: Gallery, type: ImageType) => void;
  onPreview: (url: string) => void;
}

function ImageSection({
  gallery, type, sortOrder, onSortChange,
  dragSrc, dragOver, onDragStart, onDragOver, onDrop, onDragEnd,
  onRemove, onDedup, onFilesSelected, onPreview,
}: ImageSectionProps) {
  const fileInputId = `fu-${gallery.id}-${type}`;

  const rawImages =
    type === "gallery" ? gallery.galleryImages || []
    : type === "selected" ? gallery.selectedImages || []
    : gallery.finalImages || [];

  const images = [...rawImages];
  if (sortOrder === "az") images.sort((a, b) => (a.split("/").pop() ?? "").localeCompare(b.split("/").pop() ?? ""));
  if (sortOrder === "za") images.sort((a, b) => (b.split("/").pop() ?? "").localeCompare(a.split("/").pop() ?? ""));

  return (
    <div>
      {/* Hidden file input — triggered via <label htmlFor> below (no programmatic .click()) */}
      <input
        id={fileInputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(Array.from(e.target.files), gallery, type);
            e.target.value = "";
          }
        }}
      />

      {/* Section toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h4 className="text-sm font-semibold capitalize text-green-800 mr-auto">
          {type} Images ({rawImages.length})
        </h4>
        {/* Sort */}
        <Select value={sortOrder} onValueChange={onSortChange}>
          <SelectTrigger className="h-7 text-xs w-36 border-green-200">
            <ArrowUpDown className="w-3 h-3 mr-1 shrink-0 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">Original order</SelectItem>
            <SelectItem value="az">Name A → Z</SelectItem>
            <SelectItem value="za">Name Z → A</SelectItem>
          </SelectContent>
        </Select>
        {/* Dedup */}
        <Button size="sm" variant="outline"
          className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50 px-2"
          onClick={() => onDedup(gallery, type)}>
          Remove Dupes
        </Button>
        {/* Upload — plain label so click always reaches the file input */}
        <label htmlFor={fileInputId}
          className="inline-flex items-center h-7 text-xs px-2 rounded-md border border-green-200 text-green-700 hover:bg-green-50 cursor-pointer transition-colors font-medium select-none">
          <UploadIcon className="w-3 h-3 mr-1" /> Upload
        </label>
      </div>

      {/* Image grid or empty drop zone */}
      {images.length === 0 ? (
        <label
          htmlFor={fileInputId}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-green-200 py-8 text-sm text-green-600 hover:border-green-400 hover:bg-green-50 transition-colors cursor-pointer"
        >
          <UploadIcon className="w-6 h-6 opacity-60" />
          Tap to upload photos from your device
        </label>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {images.map((url, i) => {
            const dragging = dragSrc?.galleryId === gallery.id && dragSrc?.type === type && dragSrc?.index === i;
            const over     = dragOver?.galleryId === gallery.id && dragOver?.type === type && dragOver?.index === i;
            return (
              <div
                key={`${url}-${i}`}
                draggable
                onDragStart={() => onDragStart(gallery.id, type, i)}
                onDragOver={(e) => onDragOver(e, gallery.id, type, i)}
                onDrop={() => onDrop(gallery, type, i)}
                onDragEnd={onDragEnd}
                className={`relative group aspect-square rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all shadow-sm ${
                  dragging ? "opacity-40 scale-95 border-green-400"
                  : over    ? "border-green-500 scale-[1.03] shadow-md"
                  : "bg-green-100 border-green-200"
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onClick={() => onPreview(url)}
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.15"; }} />
                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <GripVertical className="w-3.5 h-3.5 text-white drop-shadow" />
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); onPreview(url); }}
                    className="p-1.5 bg-white/90 rounded-full shadow">
                    <Eye className="w-3 h-3 text-gray-700" />
                  </button>
                  {type === "final" && (
                    <a href={url} download target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 bg-white/90 rounded-full shadow">
                      <Download className="w-3 h-3 text-green-700" />
                    </a>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); onRemove(gallery, type, url); }}
                    className="p-1.5 bg-white/90 rounded-full shadow">
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
          {/* Add-more tile — label triggers file input natively */}
          <label
            htmlFor={fileInputId}
            className="aspect-square rounded-lg border-2 border-dashed border-green-200 flex flex-col items-center justify-center text-green-500 hover:border-green-400 hover:bg-green-50 transition-colors cursor-pointer"
          >
            <UploadIcon className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Add more</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AdminGalleries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [fileItems, setFileItems]       = useState<FileItem[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [sortState, setSortState]       = useState<Record<string, string>>({});
  const [dragSrc, setDragSrc]           = useState<{ galleryId: string; type: ImageType; index: number } | null>(null);
  const [dragOver, setDragOver]         = useState<{ galleryId: string; type: ImageType; index: number } | null>(null);

  const { data: galleries, isLoading } = useQuery<Gallery[]>({
    queryKey: ["/api/admin/galleries"],
    retry: false,
  });

  const filteredGalleries = (galleries || []).filter((g) => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!g.clientEmail.toLowerCase().includes(s) && !g.accessCode.toLowerCase().includes(s) && !g.id.toLowerCase().includes(s))
        return false;
    }
    return statusFilter === "all" || g.status === statusFilter;
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const addImageMutation = useMutation({
    mutationFn: ({ galleryId, imageURL, type }: { galleryId: string; imageURL: string; type: string }) =>
      apiRequest("PUT", "/api/admin/gallery-images", { galleryId, imageURL, type }),
    onError: () => toast({ title: "Failed to save image", variant: "destructive" }),
  });

  const updateImagesMutation = useMutation({
    mutationFn: ({ galleryId, images, type }: { galleryId: string; images: string[]; type: string }) =>
      apiRequest("PATCH", `/api/admin/gallery/${galleryId}/images`, { images, type }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/galleries"] }),
    onError: () => toast({ title: "Failed to update gallery", variant: "destructive" }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: ({ galleryId, settings }: { galleryId: string; settings: { galleryDownloadEnabled?: boolean; selectedDownloadEnabled?: boolean; finalDownloadEnabled?: boolean; status?: string } }) =>
      apiRequest("PATCH", `/api/admin/gallery/${galleryId}/settings`, settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/galleries"] }),
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((galleryId: string, type: ImageType, index: number) => {
    setDragSrc({ galleryId, type, index });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, galleryId: string, type: ImageType, index: number) => {
    e.preventDefault();
    setDragOver({ galleryId, type, index });
  }, []);

  const handleDrop = useCallback((gallery: Gallery, type: ImageType, dropIndex: number) => {
    setDragSrc((src) => {
      if (!src || src.galleryId !== gallery.id || src.type !== type) return null;
      const images = type === "gallery" ? gallery.galleryImages || []
        : type === "selected" ? gallery.selectedImages || []
        : gallery.finalImages || [];
      const next = [...images];
      const [moved] = next.splice(src.index, 1);
      next.splice(dropIndex, 0, moved);
      updateImagesMutation.mutate({ galleryId: gallery.id, images: next, type });
      return null;
    });
    setDragOver(null);
  }, [updateImagesMutation]);

  const handleDragEnd = useCallback(() => { setDragSrc(null); setDragOver(null); }, []);

  const handleRemoveImage = useCallback((gallery: Gallery, type: ImageType, url: string) => {
    const images = type === "gallery" ? gallery.galleryImages || []
      : type === "selected" ? gallery.selectedImages || []
      : gallery.finalImages || [];
    updateImagesMutation.mutate({ galleryId: gallery.id, images: images.filter((u) => u !== url), type });
  }, [updateImagesMutation]);

  const handleDedup = useCallback((gallery: Gallery, type: ImageType) => {
    const images = type === "gallery" ? gallery.galleryImages || []
      : type === "selected" ? gallery.selectedImages || []
      : gallery.finalImages || [];
    const unique = Array.from(new Set(images));
    if (unique.length === images.length) { toast({ title: "No duplicates found" }); return; }
    updateImagesMutation.mutate(
      { galleryId: gallery.id, images: unique, type },
      { onSuccess: () => toast({ title: `Removed ${images.length - unique.length} duplicate(s)` }) }
    );
  }, [updateImagesMutation, toast]);

  // ── File upload ───────────────────────────────────────────────────────────

  const updateItem = useCallback((id: string, patch: Partial<FileItem>) => {
    setFileItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  // Called by ImageSection when the user picks files via the <label> → <input>
  const handleFilesSelected = useCallback(async (files: File[], gallery: Gallery, type: ImageType) => {
    const existingNames = new Set(
      [...(gallery.galleryImages || []), ...(gallery.selectedImages || []), ...(gallery.finalImages || [])]
        .map((url) => url.split("/").pop()?.split("?")[0]?.toLowerCase() ?? "")
    );
    const seenInBatch = new Set<string>();

    const items: FileItem[] = files.map((file, i) => {
      const fp = `${file.name.toLowerCase()}::${file.size}`;
      const isDuplicate = existingNames.has(file.name.toLowerCase()) || seenInBatch.has(fp);
      seenInBatch.add(fp);
      return { id: `${Date.now()}-${i}`, file, preview: URL.createObjectURL(file), status: isDuplicate ? "duplicate" : "queued", progress: 0 };
    });
    setFileItems(items);
    setShowUploadPanel(true);

    let config: SignedConfig;
    try {
      const res = await fetch("/api/admin/upload-signature", { method: "POST", credentials: "include" });
      if (!res.ok) { const err = await res.json().catch(() => ({})) as { error?: string }; throw new Error(err.error || `Error ${res.status}`); }
      config = await res.json() as SignedConfig;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      items.forEach((item) => updateItem(item.id, { status: "error", error: msg }));
      return;
    }

    const queue = items.filter((i) => i.status !== "duplicate");
    async function processNext(): Promise<void> {
      const item = queue.shift();
      if (!item) return;
      updateItem(item.id, { status: "uploading", progress: 0 });
      try {
        const compressed = await compressImage(item.file);
        const url = await uploadWithProgress(compressed, config, (pct) => updateItem(item.id, { progress: pct }));
        updateItem(item.id, { status: "done", progress: 100, cloudUrl: url });
        await addImageMutation.mutateAsync({ galleryId: gallery.id, imageURL: url, type });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/galleries"] });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        updateItem(item.id, { status: "error", error: msg });
      }
      return processNext();
    }
    await Promise.all(Array.from({ length: 3 }, processNext));
  }, [addImageMutation, queryClient, updateItem]);

  const closeUploadPanel = () => {
    fileItems.forEach((i) => URL.revokeObjectURL(i.preview));
    setFileItems([]);
    setShowUploadPanel(false);
  };

  const allFinished = fileItems.length > 0 && fileItems.every((i) => i.status === "done" || i.status === "error" || i.status === "duplicate");

  const statusColor = (s: string) =>
    s === "pending" ? "bg-orange-500" : s === "active" ? "bg-blue-500"
    : s === "completed" ? "bg-green-700" : s === "editing" ? "bg-purple-500"
    : s === "selection" ? "bg-cyan-500" : "bg-gray-500";

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  if (isLoading)
    return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  return (
    <div className="space-y-6">
      <Card className="border-green-100">
        <CardHeader className="bg-gradient-to-r from-green-50 to-yellow-50 rounded-t-xl border-b border-green-100">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <ImageIcon className="w-5 h-5" /> Gallery Management
          </CardTitle>
          <CardDescription className="text-green-600">
            Upload, drag to reorder, and manage client gallery photos.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Input placeholder="Search by email, code, or ID…" value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs border-green-200 focus-visible:ring-green-500" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 border-green-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="selection">Selection</SelectItem>
                <SelectItem value="editing">Editing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50"
              onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}>Clear</Button>
            <span className="text-sm text-green-600 self-center">
              {filteredGalleries.length} / {galleries?.length || 0}
            </span>
          </div>

          <div className="space-y-4">
            {filteredGalleries.length === 0 ? (
              <p className="text-center py-8 text-green-600">No galleries found.</p>
            ) : (
              filteredGalleries.map((gallery) => {
                const isExpanded = expandedId === gallery.id;
                return (
                  <Card key={gallery.id} className="border border-green-100 shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate text-green-900">{gallery.clientEmail}</span>
                            <Badge className={`${statusColor(gallery.status)} text-white text-[10px] shrink-0`}>
                              {gallery.status.toUpperCase()}
                            </Badge>
                            {!gallery.galleryDownloadEnabled && !gallery.selectedDownloadEnabled && !gallery.finalDownloadEnabled && (
                              <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 shrink-0">
                                Downloads OFF
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-green-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>Code: <strong>{gallery.accessCode}</strong></span>
                            <span>{formatDate(gallery.createdAt)}</span>
                            <span>{gallery.galleryImages?.length || 0} gallery · {gallery.selectedImages?.length || 0} selected · {gallery.finalImages?.length || 0} final</span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline"
                            className="hidden sm:flex border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => window.open(`/gallery/${gallery.clientEmail}/${gallery.accessCode}`, "_blank")}>
                            <Eye className="w-4 h-4 mr-1" /> Client View
                          </Button>
                          <Button size="sm"
                            variant={isExpanded ? "default" : "outline"}
                            className={isExpanded ? "bg-green-700 hover:bg-green-800 text-white" : "border-green-200 text-green-700 hover:bg-green-50"}
                            onClick={() => setExpandedId(isExpanded ? null : gallery.id)}>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            <span className="ml-1">{isExpanded ? "Collapse" : "Manage"}</span>
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-green-100 space-y-6">
                          {/* Manage toolbar */}
                          <div className="flex flex-wrap gap-3 items-center p-3 bg-green-50 rounded-xl border border-green-100">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-700 font-medium">Status:</span>
                              <Select value={gallery.status}
                                onValueChange={(v) => updateSettingsMutation.mutate({ galleryId: gallery.id, settings: { status: v } })}>
                                <SelectTrigger className="h-7 w-32 text-xs border-green-200"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="selection">Selection</SelectItem>
                                  <SelectItem value="editing">Editing</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-3 ml-auto sm:ml-0 flex-wrap">
                              <Download className="w-3.5 h-3.5 text-green-700 shrink-0" />
                              <span className="text-xs text-green-700 font-medium">Downloads:</span>
                              <label className="flex items-center gap-1 text-xs text-green-700">
                                <Switch
                                  checked={gallery.galleryDownloadEnabled}
                                  onCheckedChange={(v) => updateSettingsMutation.mutate({ galleryId: gallery.id, settings: { galleryDownloadEnabled: v } })}
                                />
                                Gallery
                              </label>
                              <label className="flex items-center gap-1 text-xs text-green-700">
                                <Switch
                                  checked={gallery.selectedDownloadEnabled}
                                  onCheckedChange={(v) => updateSettingsMutation.mutate({ galleryId: gallery.id, settings: { selectedDownloadEnabled: v } })}
                                />
                                Selected
                              </label>
                              <label className="flex items-center gap-1 text-xs text-green-700">
                                <Switch
                                  checked={gallery.finalDownloadEnabled}
                                  onCheckedChange={(v) => updateSettingsMutation.mutate({ galleryId: gallery.id, settings: { finalDownloadEnabled: v } })}
                                />
                                Final
                              </label>
                            </div>
                          </div>

                          {/* Image sections */}
                          {(["gallery", "selected", "final"] as ImageType[]).map((type) => (
                            <ImageSection
                              key={type}
                              gallery={gallery}
                              type={type}
                              sortOrder={sortState[`${gallery.id}::${type}`] || "original"}
                              onSortChange={(v) => setSortState((prev) => ({ ...prev, [`${gallery.id}::${type}`]: v }))}
                              dragSrc={dragSrc}
                              dragOver={dragOver}
                              onDragStart={handleDragStart}
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                              onDragEnd={handleDragEnd}
                              onRemove={handleRemoveImage}
                              onDedup={handleDedup}
                              onFilesSelected={handleFilesSelected}
                              onPreview={setPreviewImage}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {showUploadPanel && fileItems.length > 0 && (
        <UploadPanel items={fileItems} onClose={closeUploadPanel} canClose={allFinished} />
      )}

      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-0">
          <img src={previewImage || ""} alt="" className="w-full h-auto max-h-[85vh] object-contain rounded" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
