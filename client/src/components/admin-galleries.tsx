import { useState, useRef, useCallback, Component, type ReactNode, type ErrorInfo, useEffect } from "react";

// ── Error Boundary ─────────────────────────────────────────────────────────────
class GalleryErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Gallery render error:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <strong>Render error:</strong> {(this.state.error as Error).message}
          <br /><span className="text-xs opacity-70">Check the browser console for details</span>
          <br /><button className="underline text-xs mt-1" onClick={() => this.setState({ error: null })}>Dismiss</button>
        </div>
      );
    }
    return this.props.children;
  }
}
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
  FolderPlus, Folder, Trash2,
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
  imageFolders: Record<string, Record<string, string[]>>; // { gallery: { "Reception": [...] }, final: {...} }
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
  status: FileStatus;
  progress: number;
  cloudUrl?: string;
  error?: string;
}

// ── Cloudinary upload ─────────────────────────────────────────────────────────
// ── Image compression ─────────────────────────────────────────────────────────
// Called just-in-time inside the upload queue (max 6 concurrent) so we never
// run hundreds of canvas operations at once. Keeps files under Cloudinary's
// 10 MB free-plan limit while preserving 3 K resolution for client viewing.

function compressImage(file: File, maxDimension = 3000, quality = 0.82): Promise<File> {
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
          // If compression actually made it larger, keep the original
          if (blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg", quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

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

// Sends one chunk via XHR so we get per-byte progress even for large files.
// 9 MB per chunk — safely under Cloudinary's 10 MB single-upload limit.
// Any file larger than 9 MB is split into chunks, bypassing the limit.
const CHUNK_SIZE = 9 * 1024 * 1024;

function uploadChunkXHR(
  chunk: Blob, byteStart: number, totalSize: number,
  uploadId: string, config: SignedConfig,
  onBytesLoaded: (totalLoaded: number) => void,
): Promise<{ secureUrl?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onBytesLoaded(byteStart + e.loaded);
    });
    xhr.addEventListener("load", () => {
      if (xhr.status === 200 || xhr.status === 308) {
        try { resolve({ secureUrl: (JSON.parse(xhr.responseText) as { secure_url?: string }).secure_url }); }
        catch { resolve({}); }
      } else {
        try { const e = JSON.parse(xhr.responseText) as { error?: { message?: string } }; reject(new Error(e?.error?.message || `Chunk failed (${xhr.status})`)); }
        catch { reject(new Error(`Chunk failed (${xhr.status})`)); }
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error")));
    const fd = new FormData();
    fd.append("file", chunk);
    fd.append("api_key", config.apiKey);
    fd.append("timestamp", String(config.timestamp));
    fd.append("signature", config.signature);
    const byteEnd = byteStart + chunk.size - 1;
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`);
    xhr.setRequestHeader("X-Unique-Upload-Id", uploadId);
    xhr.setRequestHeader("Content-Range", `bytes ${byteStart}-${byteEnd}/${totalSize}`);
    xhr.send(fd);
  });
}

// Unified upload: single XHR for files ≤ 9 MB, chunked for larger files.
// Chunked uploads bypass Cloudinary's 10 MB per-request limit.
async function uploadFile(
  file: File, config: SignedConfig, onProgress: (pct: number) => void,
): Promise<string> {
  if (file.size < CHUNK_SIZE) {
    return uploadWithProgress(file, config, onProgress);
  }
  const uploadId = crypto.randomUUID();
  const total = file.size;
  const chunks = Math.ceil(total / CHUNK_SIZE);
  let secureUrl = "";
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, total);
    const result = await uploadChunkXHR(
      file.slice(start, end), start, total, uploadId, config,
      (loaded) => onProgress(Math.round((loaded / total) * 100)),
    );
    if (result.secureUrl) secureUrl = result.secureUrl;
  }
  if (!secureUrl) throw new Error("Upload incomplete — no URL returned");
  return secureUrl;
}

// ── Upload panel ──────────────────────────────────────────────────────────────

// Single row in the upload panel — no image preview, just status + progress.
function FileRow({ item }: { item: FileItem }) {
  const sizeMB = item.file.size < 1024 * 1024
    ? `${(item.file.size / 1024).toFixed(0)} KB`
    : `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-green-100 last:border-0">
      <div className="w-5 shrink-0 flex items-center justify-center">
        {item.status === "queued"    && <Clock className="w-4 h-4 text-green-400" />}
        {item.status === "uploading" && <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />}
        {item.status === "done"      && <CheckCircle2 className="w-4 h-4 text-green-600" />}
        {item.status === "duplicate" && <Copy className="w-4 h-4 text-amber-500" />}
        {item.status === "error"     && <AlertCircle className="w-4 h-4 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-gray-700 truncate">{item.file.name}</span>
          <span className="text-[10px] text-gray-400 shrink-0">{sizeMB}</span>
        </div>
        {item.status === "uploading" && (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
            <div className="bg-yellow-400 rounded-full h-1 transition-all duration-100" style={{ width: `${item.progress}%` }} />
          </div>
        )}
        {item.status === "error"     && <p className="text-[10px] text-red-500 truncate">{item.error}</p>}
        {item.status === "duplicate" && <p className="text-[10px] text-amber-600">Already in gallery — skipped</p>}
      </div>
      {item.status === "uploading" && (
        <span className="text-xs text-gray-400 tabular-nums w-8 text-right shrink-0">{item.progress}%</span>
      )}
    </div>
  );
}

// Virtual list — only renders visible rows so 2000+ items stay performant.
const ITEM_H = 52; // px, matches FileRow height
const PANEL_LIST_H = 360; // px max visible area

function VirtualFileList({ items }: { items: FileItem[] }) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerH = Math.min(items.length * ITEM_H, PANEL_LIST_H);
  const visibleCount = Math.ceil(PANEL_LIST_H / ITEM_H) + 2;
  const startIdx = Math.max(0, Math.floor(scrollTop / ITEM_H) - 1);
  const endIdx   = Math.min(startIdx + visibleCount, items.length);

  // Auto-scroll to first uploading item
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const firstActive = items.findIndex((i) => i.status === "uploading");
    if (firstActive >= 0 && listRef.current) {
      const targetScroll = firstActive * ITEM_H;
      if (targetScroll > scrollTop + PANEL_LIST_H - ITEM_H * 2) {
        listRef.current.scrollTop = targetScroll - ITEM_H;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return (
    <div
      ref={listRef}
      className="overflow-y-auto bg-green-50"
      style={{ height: containerH }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * ITEM_H, position: "relative" }}>
        {items.slice(startIdx, endIdx).map((item, i) => (
          <div key={item.id} style={{ position: "absolute", top: (startIdx + i) * ITEM_H, width: "100%", height: ITEM_H }}>
            <FileRow item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatEta(seconds: number): string {
  if (seconds <= 5)  return "almost done";
  if (seconds < 60)  return `~${seconds}s remaining`;
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return s > 0 ? `~${m}m ${s}s remaining` : `~${m}m remaining`;
}

function UploadPanel({ items, onClose, canClose, onCancel, onRetry, startTime }: {
  items: FileItem[]; onClose: () => void; canClose: boolean;
  onCancel: () => void; onRetry: () => void; startTime: number | null;
}) {
  const done       = items.filter((i) => i.status === "done").length;
  const errors     = items.filter((i) => i.status === "error").length;
  const duplicates = items.filter((i) => i.status === "duplicate").length;
  const uploading  = items.filter((i) => i.status === "uploading").length;
  const queued     = items.filter((i) => i.status === "queued").length;
  const uploadable = items.filter((i) => i.status !== "duplicate");
  const total      = uploadable.length;
  const overallPct = total === 0 ? 100
    : Math.round(uploadable.reduce((s, i) => s + (i.status === "done" ? 100 : i.progress), 0) / total);

  // Tick every second to keep ETA fresh
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (canClose) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [canClose]);

  // ETA calculation
  let etaText = "";
  if (!canClose && startTime && overallPct > 0 && overallPct < 100) {
    void tick; // depend on tick so it re-computes each second
    const elapsedMs = Date.now() - startTime;
    const totalBytes = uploadable.reduce((s, i) => s + i.file.size, 0);
    const doneBytes  = items.filter((i) => i.status === "done").reduce((s, i) => s + i.file.size, 0);
    const partBytes  = items.filter((i) => i.status === "uploading").reduce((s, i) => s + i.file.size * i.progress / 100, 0);
    const uploadedBytes = doneBytes + partBytes;
    const rate = uploadedBytes / (elapsedMs / 1000); // bytes/sec
    if (rate > 0) etaText = formatEta(Math.round((totalBytes - uploadedBytes) / rate));
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg w-[95vw] p-0 overflow-hidden rounded-2xl gap-0">
        <div className="bg-gradient-to-r from-green-800 to-green-700 px-5 py-4 text-white">
          <DialogTitle className="text-base font-semibold mb-1">
            {canClose
              ? `Done — ${done} saved${duplicates > 0 ? `, ${duplicates} skipped` : ""}${errors > 0 ? `, ${errors} failed` : ""}`
              : `Uploading ${done} / ${total} photos…`}
          </DialogTitle>
          <div className="flex items-center gap-3">
            <Progress value={overallPct} className="flex-1 h-1.5 bg-white/20 [&>div]:bg-yellow-400 [&>div]:transition-all" />
            <span className="text-xs text-white/70 tabular-nums w-8 text-right">{overallPct}%</span>
          </div>
          {etaText && (
            <p className="text-xs text-white/60 mt-1">{etaText}</p>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex gap-4 px-4 py-2 bg-white border-b border-green-100 text-xs">
          <span className="text-green-700"><strong>{items.length}</strong> files</span>
          {queued    > 0 && <span className="text-gray-500">{queued} waiting</span>}
          {uploading > 0 && <span className="text-yellow-600">{uploading} uploading</span>}
          {done      > 0 && <span className="text-green-600">{done} done</span>}
          {errors    > 0 && <span className="text-red-600">{errors} failed</span>}
          {duplicates > 0 && <span className="text-amber-600">{duplicates} skipped</span>}
        </div>

        <VirtualFileList items={items} />

        <div className="px-5 py-3 border-t border-green-100 bg-white flex items-center justify-between gap-3">
          <p className="text-xs text-green-700 leading-snug">
            {canClose
              ? errors > 0 ? `${errors} photo${errors > 1 ? "s" : ""} failed — click Try Again to retry`
                : duplicates > 0 ? `${duplicates} duplicate${duplicates > 1 ? "s" : ""} skipped · all others saved`
                : "All photos saved to Connectagrapher"
              : "Saving photos to Connectagrapher…"}
          </p>
          <div className="flex gap-2 shrink-0">
            {canClose && errors > 0 && (
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={onRetry}>
                Try Again
              </Button>
            )}
            {canClose ? (
              <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={onClose}>
                Done
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Image section ──────────────────────────────────────────────────────────────

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
  onRemoveMany: (gallery: Gallery, type: ImageType, urls: string[]) => void;
  onDedup: (gallery: Gallery, type: ImageType) => void;
  onFilesSelected: (files: File[], gallery: Gallery, type: ImageType) => void;
  onPreview: (url: string) => void;
  // Folder props
  activeFolder: string;           // "" = All
  uploadFolder: string;           // folder new uploads go to ("" = no folder)
  newFolderInput: string;
  onFolderView: (folder: string) => void;
  onUploadFolderChange: (folder: string) => void;
  onNewFolderInputChange: (v: string) => void;
  onCreateFolder: (name: string) => void;
}

function ImageSection({
  gallery, type, sortOrder, onSortChange,
  dragSrc, dragOver, onDragStart, onDragOver, onDrop, onDragEnd,
  onRemove, onRemoveMany, onDedup, onFilesSelected, onPreview,
  activeFolder, uploadFolder, newFolderInput,
  onFolderView, onUploadFolderChange, onNewFolderInputChange, onCreateFolder,
}: ImageSectionProps) {
  const fileInputId = `fu-${gallery.id}-${type}`;
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [fileDragOver, setFileDragOver] = useState(false);
  const dragCounterRef = useRef(0); // track nested enter/leave events

  // ── Multi-select ──────────────────────────────────────────────────────────
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const lastSelectedIdxRef = useRef<number | null>(null);

  // Clear selection when switching folders
  useEffect(() => {
    setSelectedUrls(new Set());
    lastSelectedIdxRef.current = null;
  }, [activeFolder]);

  // Escape key clears selection
  useEffect(() => {
    if (selectedUrls.size === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelectedUrls(new Set()); lastSelectedIdxRef.current = null; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedUrls.size]);

  const handleImageClick = (e: React.MouseEvent, url: string, idx: number) => {
    if (e.shiftKey) {
      // Range select from last selected index to current
      const from = lastSelectedIdxRef.current ?? idx;
      const lo = Math.min(from, idx), hi = Math.max(from, idx);
      setSelectedUrls((prev) => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i++) { const u = imagesToShow[i]; if (u) next.add(u); }
        return next;
      });
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle individual
      setSelectedUrls((prev) => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url); else next.add(url);
        return next;
      });
      lastSelectedIdxRef.current = idx;
    } else if (selectedUrls.size > 0) {
      // In selection mode — plain click toggles
      setSelectedUrls((prev) => {
        const next = new Set(prev);
        if (next.has(url)) next.delete(url); else next.add(url);
        return next;
      });
      lastSelectedIdxRef.current = idx;
    } else {
      // No selection active — open preview
      onPreview(url);
    }
  };

  const handleDeleteSelected = () => {
    const urls = Array.from(selectedUrls);
    onRemoveMany(gallery, type, urls);
    setSelectedUrls(new Set());
    lastSelectedIdxRef.current = null;
  };

  const isFileDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.length > 0 &&
    Array.from(e.dataTransfer.types).some((t) => t === "Files");

  const handleZoneDragEnter = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setFileDragOver(true);
  };
  const handleZoneDragLeave = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) { dragCounterRef.current = 0; setFileDragOver(false); }
  };
  const handleZoneDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleZoneDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setFileDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) onFilesSelected(files, gallery, type);
  };

  const allImages =
    type === "gallery"  ? gallery.galleryImages  || []
    : type === "selected" ? gallery.selectedImages || []
    : gallery.finalImages || [];

  const typeFolders = ((gallery.imageFolders || {}) as Record<string, Record<string, string[]>>)[type] || {};
  const folderNames = Object.keys(typeFolders).sort();

  // Determine images to show based on active folder
  let imagesToShow = [...allImages];
  if (activeFolder) {
    imagesToShow = typeFolders[activeFolder] || [];
  }

  // Sort (only in All view — folder view order is preserved)
  if (!activeFolder) {
    if (sortOrder === "az") imagesToShow = [...imagesToShow].sort((a, b) => (a.split("/").pop() ?? "").localeCompare(b.split("/").pop() ?? ""));
    if (sortOrder === "za") imagesToShow = [...imagesToShow].sort((a, b) => (b.split("/").pop() ?? "").localeCompare(a.split("/").pop() ?? ""));
  }

  const handleCreateFolder = () => {
    const name = newFolderInput.trim();
    if (!name) return;
    onCreateFolder(name);
    onFolderView(name);
    onUploadFolderChange(name);
    setShowFolderInput(false);
    onNewFolderInputChange("");
  };

  // Map from displayed index back to allImages index for drag-drop
  // Only meaningful in All view
  const getAbsoluteIndex = (displayIndex: number) => displayIndex; // all view = same

  return (
    <div>
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

      {/* Section header */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h4 className="text-sm font-semibold capitalize text-green-800 mr-auto">
          {type} Images ({allImages.length})
          {selectedUrls.size > 0 && (
            <span className="ml-2 text-blue-600 font-normal text-xs">· {selectedUrls.size} selected</span>
          )}
        </h4>

        {selectedUrls.size > 0 ? (
          /* Selection-mode toolbar */
          <>
            <Button size="sm" variant="outline"
              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 px-2"
              onClick={handleDeleteSelected}>
              <Trash2 className="w-3 h-3 mr-1" /> Delete {selectedUrls.size}
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 text-xs text-gray-500 px-2"
              onClick={() => { setSelectedUrls(new Set()); lastSelectedIdxRef.current = null; }}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          </>
        ) : (
          /* Normal toolbar */
          <>
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
            <Button size="sm" variant="outline"
              className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50 px-2"
              onClick={() => onDedup(gallery, type)}>
              Remove Dupes
            </Button>
            <label htmlFor={fileInputId}
              className="inline-flex items-center h-7 text-xs px-2 rounded-md border border-green-200 text-green-700 hover:bg-green-50 cursor-pointer transition-colors font-medium select-none">
              <UploadIcon className="w-3 h-3 mr-1" /> Upload
            </label>
          </>
        )}
      </div>
      {selectedUrls.size > 0 && (
        <p className="text-[10px] text-gray-400 mb-2">Shift+click for range · Cmd/Ctrl+click to toggle · Esc to clear</p>
      )}

      {/* Folder tabs */}
      {folderNames.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-2 border-b border-green-100">
          <button
            onClick={() => onFolderView("")}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
              activeFolder === "" ? "bg-green-700 text-white" : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            All ({allImages.length})
          </button>
          {folderNames.map((folder) => (
            <button
              key={folder}
              onClick={() => onFolderView(folder)}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                activeFolder === folder ? "bg-green-700 text-white" : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
            >
              <Folder className="w-3 h-3" />
              {folder} ({typeFolders[folder]?.length || 0})
            </button>
          ))}
        </div>
      )}

      {/* Upload destination + new folder */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-green-600 font-medium shrink-0">Upload to:</span>
        <Select
          value={uploadFolder || "__none__"}
          onValueChange={(v) => onUploadFolderChange(v === "__none__" ? "" : v)}
        >
          <SelectTrigger className="h-7 text-xs border-green-200 w-44">
            <SelectValue placeholder="No folder (general)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No folder (general)</SelectItem>
            {folderNames.map((f) => (
              <SelectItem key={f} value={f}>
                <span className="flex items-center gap-1"><Folder className="w-3 h-3" />{f}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showFolderInput ? (
          <div className="flex items-center gap-1">
            <Input
              value={newFolderInput}
              onChange={(e) => onNewFolderInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") { setShowFolderInput(false); onNewFolderInputChange(""); }
              }}
              placeholder="Folder name…"
              className="h-7 text-xs border-green-200 w-32"
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs bg-green-700 hover:bg-green-800 text-white px-2" onClick={handleCreateFolder}>
              Add
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => { setShowFolderInput(false); onNewFolderInputChange(""); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline"
            className="h-7 text-xs border-green-200 text-green-700 hover:bg-green-50 px-2 shrink-0"
            onClick={() => setShowFolderInput(true)}>
            <FolderPlus className="w-3 h-3 mr-1" /> New Folder
          </Button>
        )}
      </div>

      {/* Image grid or empty drop zone — wrapped in file-drag zone */}
      <div
        className="relative"
        onDragEnter={handleZoneDragEnter}
        onDragLeave={handleZoneDragLeave}
        onDragOver={handleZoneDragOver}
        onDrop={handleZoneDrop}
      >
        {/* File-drag overlay */}
        {fileDragOver && (
          <div className="absolute inset-0 z-20 rounded-xl border-2 border-dashed border-green-500 bg-green-50/90 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <UploadIcon className="w-8 h-8 text-green-600" />
            <span className="text-sm font-semibold text-green-700">Drop photos to upload</span>
          </div>
        )}

      {imagesToShow.length === 0 ? (
        <label
          htmlFor={fileInputId}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-green-200 py-8 text-sm text-green-600 hover:border-green-400 hover:bg-green-50 transition-colors cursor-pointer"
        >
          <UploadIcon className="w-6 h-6 opacity-60" />
          {activeFolder
            ? `No photos in "${activeFolder}" yet — tap or drag to upload`
            : "Tap or drag photos here to upload"}
        </label>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {imagesToShow.map((url, i) => {
            const absIdx = getAbsoluteIndex(i);
            const canDrag = !activeFolder && selectedUrls.size === 0; // disable drag in folder view or when selecting
            const dragging  = canDrag && dragSrc?.galleryId === gallery.id && dragSrc?.type === type && dragSrc?.index === absIdx;
            const over      = canDrag && dragOver?.galleryId === gallery.id && dragOver?.type === type && dragOver?.index === absIdx;
            const isSelected = selectedUrls.has(url);
            return (
              <div
                key={`${url}-${i}`}
                draggable={canDrag}
                onDragStart={canDrag ? () => onDragStart(gallery.id, type, absIdx) : undefined}
                onDragOver={canDrag ? (e) => onDragOver(e, gallery.id, type, absIdx) : undefined}
                onDrop={canDrag ? () => onDrop(gallery, type, absIdx) : undefined}
                onDragEnd={canDrag ? onDragEnd : undefined}
                onClick={(e) => handleImageClick(e, url, i)}
                className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all shadow-sm cursor-pointer ${
                  isSelected  ? "border-blue-500 ring-2 ring-blue-300 scale-[0.97]"
                  : dragging  ? "opacity-40 scale-95 border-green-400"
                  : over      ? "border-green-500 scale-[1.03] shadow-md"
                  : "bg-green-100 border-green-200"
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.15"; }} />

                {/* Selected overlay with checkmark */}
                {isSelected && (
                  <div className="absolute inset-0 bg-blue-600/30 flex items-start justify-end p-1.5 pointer-events-none">
                    <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shadow">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                )}

                {/* Drag handle (when not in selection mode) */}
                {canDrag && (
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <GripVertical className="w-3.5 h-3.5 text-white drop-shadow" />
                  </div>
                )}

                {/* Hover actions (only when no selection active) */}
                {selectedUrls.size === 0 && (
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
                )}
              </div>
            );
          })}
          {/* Add-more tile */}
          <label
            htmlFor={fileInputId}
            className="aspect-square rounded-lg border-2 border-dashed border-green-200 flex flex-col items-center justify-center text-green-500 hover:border-green-400 hover:bg-green-50 transition-colors cursor-pointer"
          >
            <UploadIcon className="w-4 h-4 mb-0.5" />
            <span className="text-[10px]">Add more</span>
          </label>
        </div>
      )}
      </div>{/* end file-drag zone */}
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

  // Folder state — key is `galleryId::type`
  const [activeFolderView, setActiveFolderView] = useState<Record<string, string>>({});
  const [uploadDestFolder, setUploadDestFolder] = useState<Record<string, string>>({});
  const [newFolderInputs, setNewFolderInputs]   = useState<Record<string, string>>({});

  // Ref for upload destination — lets handleFilesSelected always read the latest
  // value without including the state object in useCallback deps (avoids re-renders)
  const uploadDestFolderRef = useRef<Record<string, string>>({});

  // Cancel flag for uploads
  const cancelRef = useRef(false);

  // Cached upload signature — refreshed automatically if > 30 minutes old
  const uploadConfigRef    = useRef<SignedConfig | null>(null);
  const uploadConfigTimeRef = useRef<number>(0);

  // ETA tracking
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);

  // Retry support — store current gallery/type context + latest fileItems
  const currentUploadCtxRef = useRef<{ gallery: Gallery; type: ImageType } | null>(null);
  const fileItemsRef = useRef<FileItem[]>([]);
  useEffect(() => { fileItemsRef.current = fileItems; }, [fileItems]);

  const { data: galleries, isLoading, isError, error, refetch } = useQuery<Gallery[]>({
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
    mutationFn: ({ galleryId, settings }: { galleryId: string; settings: object }) =>
      apiRequest("PATCH", `/api/admin/gallery/${galleryId}/settings`, settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/galleries"] }),
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  const updateFoldersMutation = useMutation({
    mutationFn: ({ galleryId, folders }: { galleryId: string; folders: Record<string, Record<string, string[]>> }) =>
      apiRequest("PATCH", `/api/admin/gallery/${galleryId}/folders`, { folders }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/galleries"] }),
    onError: () => toast({ title: "Failed to save folder assignments", variant: "destructive" }),
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

    // Also remove from any folder mapping
    const currentFolders = (gallery.imageFolders || {}) as Record<string, Record<string, string[]>>;
    const typeFolders = { ...(currentFolders[type] || {}) };
    let changed = false;
    for (const fname of Object.keys(typeFolders)) {
      const filtered = typeFolders[fname].filter((u) => u !== url);
      if (filtered.length !== typeFolders[fname].length) { typeFolders[fname] = filtered; changed = true; }
    }
    if (changed) updateFoldersMutation.mutate({ galleryId: gallery.id, folders: { ...currentFolders, [type]: typeFolders } });
  }, [updateImagesMutation, updateFoldersMutation]);

  const handleRemoveManyImages = useCallback((gallery: Gallery, type: ImageType, urls: string[]) => {
    const urlSet = new Set(urls);
    const images = type === "gallery" ? gallery.galleryImages || []
      : type === "selected" ? gallery.selectedImages || []
      : gallery.finalImages || [];
    updateImagesMutation.mutate({ galleryId: gallery.id, images: images.filter((u) => !urlSet.has(u)), type });
    // Clean folders too
    const currentFolders = (gallery.imageFolders || {}) as Record<string, Record<string, string[]>>;
    const typeFolders = { ...(currentFolders[type] || {}) };
    let changed = false;
    for (const fname of Object.keys(typeFolders)) {
      const filtered = typeFolders[fname].filter((u) => !urlSet.has(u));
      if (filtered.length !== typeFolders[fname].length) { typeFolders[fname] = filtered; changed = true; }
    }
    if (changed) updateFoldersMutation.mutate({ galleryId: gallery.id, folders: { ...currentFolders, [type]: typeFolders } });
  }, [updateImagesMutation, updateFoldersMutation]);

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

  // ── Folder handlers ──────────────────────────────────────────────────────────

  const fKey = (galleryId: string, type: ImageType) => `${galleryId}::${type}`;

  const handleFolderView = useCallback((galleryId: string, type: ImageType, folder: string) => {
    setActiveFolderView((prev) => ({ ...prev, [fKey(galleryId, type)]: folder }));
  }, []);

  const handleUploadFolderChange = useCallback((galleryId: string, type: ImageType, folder: string) => {
    const key = fKey(galleryId, type);
    setUploadDestFolder((prev) => ({ ...prev, [key]: folder }));
    uploadDestFolderRef.current[key] = folder;
  }, []);

  const handleNewFolderInputChange = useCallback((galleryId: string, type: ImageType, v: string) => {
    setNewFolderInputs((prev) => ({ ...prev, [fKey(galleryId, type)]: v }));
  }, []);

  const handleCreateFolder = useCallback((gallery: Gallery, type: ImageType, name: string) => {
    const currentFolders = (gallery.imageFolders || {}) as Record<string, Record<string, string[]>>;
    const typeFolders = { ...(currentFolders[type] || {}) };
    if (!typeFolders[name]) {
      typeFolders[name] = [];
      updateFoldersMutation.mutate({ galleryId: gallery.id, folders: { ...currentFolders, [type]: typeFolders } });
    }
    // State/ref updates are handled by ImageSection calling onFolderView + onUploadFolderChange
    const key = fKey(gallery.id, type);
    setUploadDestFolder((prev) => ({ ...prev, [key]: name }));
    uploadDestFolderRef.current[key] = name;
    setActiveFolderView((prev) => ({ ...prev, [key]: name }));
    setNewFolderInputs((prev) => ({ ...prev, [key]: "" }));
  }, [updateFoldersMutation]);

  // ── File upload ───────────────────────────────────────────────────────────────

  const updateItem = useCallback((id: string, patch: Partial<FileItem>) => {
    setFileItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  // Returns a fresh (or cached) upload signature, auto-refreshing every 30 min.
  const getUploadConfig = useCallback(async (): Promise<SignedConfig> => {
    const now = Date.now();
    if (uploadConfigRef.current && now - uploadConfigTimeRef.current < 30 * 60 * 1000) {
      return uploadConfigRef.current;
    }
    const res = await fetch("/api/admin/upload-signature", { method: "POST", credentials: "include" });
    if (!res.ok) { const err = await res.json().catch(() => ({})) as { error?: string }; throw new Error(err.error || `Error ${res.status}`); }
    const config = await res.json() as SignedConfig;
    uploadConfigRef.current = config;
    uploadConfigTimeRef.current = now;
    return config;
  }, []);

  // Shared upload runner used by both handleFilesSelected and retryFailed
  const runUploadQueue = useCallback(async (queue: FileItem[], gallery: Gallery, type: ImageType) => {
    cancelRef.current = false;
    setUploadStartTime(Date.now());
    const destFolder = uploadDestFolderRef.current[fKey(gallery.id, type)] || "";
    const uploadedUrls: string[] = [];

    async function processNext(): Promise<void> {
      if (cancelRef.current) return;
      const item = queue.shift();
      if (!item) return;
      updateItem(item.id, { status: "uploading", progress: 0 });
      try {
        const config = await getUploadConfig();
        // Compress just-in-time — only 6 canvas ops active at once, no freeze
        const toUpload = await compressImage(item.file);
        const url = await uploadFile(toUpload, config, (pct) => updateItem(item.id, { progress: pct }));
        updateItem(item.id, { status: "done", progress: 100, cloudUrl: url });
        uploadedUrls.push(url);
        await addImageMutation.mutateAsync({ galleryId: gallery.id, imageURL: url, type });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/galleries"] });
      } catch (err: unknown) {
        if (cancelRef.current) return;
        updateItem(item.id, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
      }
      return processNext();
    }
    await Promise.all(Array.from({ length: 6 }, processNext));

    if (destFolder && uploadedUrls.length > 0 && !cancelRef.current) {
      const latestGalleries = queryClient.getQueryData<Gallery[]>(["/api/admin/galleries"]);
      const latestGallery   = latestGalleries?.find((g) => g.id === gallery.id);
      const currentFolders  = ((latestGallery?.imageFolders || {}) as Record<string, Record<string, string[]>>);
      const typeFolders     = { ...(currentFolders[type] || {}) };
      if (!typeFolders[destFolder]) typeFolders[destFolder] = [];
      const existing = new Set(typeFolders[destFolder]);
      uploadedUrls.forEach((u) => { if (!existing.has(u)) typeFolders[destFolder].push(u); });
      await updateFoldersMutation.mutateAsync({ galleryId: gallery.id, folders: { ...currentFolders, [type]: typeFolders } });
    }
  }, [addImageMutation, queryClient, updateItem, updateFoldersMutation, getUploadConfig]);

  const handleFilesSelected = useCallback(async (files: File[], gallery: Gallery, type: ImageType) => {
    currentUploadCtxRef.current = { gallery, type };

    const existingNames = new Set(
      [...(gallery.galleryImages || []), ...(gallery.selectedImages || []), ...(gallery.finalImages || [])]
        .map((url) => url.split("/").pop()?.split("?")[0]?.toLowerCase() ?? "")
    );
    const seenInBatch = new Set<string>();
    const items: FileItem[] = files.map((file, i) => {
      const fp = `${file.name.toLowerCase()}::${file.size}`;
      const isDuplicate = existingNames.has(file.name.toLowerCase()) || seenInBatch.has(fp);
      seenInBatch.add(fp);
      return { id: `${Date.now()}-${i}`, file, status: isDuplicate ? "duplicate" : "queued", progress: 0 };
    });
    setFileItems(items);
    setShowUploadPanel(true);

    try { await getUploadConfig(); }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not get upload credentials";
      setFileItems((prev) => prev.map((item) => item.status === "queued" ? { ...item, status: "error", error: msg } : item));
      return;
    }
    await runUploadQueue(items.filter((i) => i.status !== "duplicate"), gallery, type);
  }, [getUploadConfig, runUploadQueue]);

  const handleRetryFailed = useCallback(async () => {
    const ctx = currentUploadCtxRef.current;
    if (!ctx) return;
    const failed = fileItemsRef.current.filter((i) => i.status === "error");
    if (failed.length === 0) return;
    // Reset failed items to queued
    failed.forEach((item) => updateItem(item.id, { status: "queued", progress: 0, error: undefined }));
    // Re-run upload for those items (use a copy since queue.shift() mutates)
    await runUploadQueue([...failed].map((i) => ({ ...i, status: "queued" as FileStatus, progress: 0 })), ctx.gallery, ctx.type);
  }, [runUploadQueue, updateItem]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    // Mark all queued/uploading items as cancelled so the panel becomes closeable
    setFileItems((prev) => prev.map((i) =>
      i.status === "queued" || i.status === "uploading"
        ? { ...i, status: "error" as FileStatus, error: "Cancelled", progress: 0 }
        : i
    ));
  }, []);

  const closeUploadPanel = useCallback(() => {
    cancelRef.current = true;
    setFileItems([]);
    setShowUploadPanel(false);
  }, []);

  const allFinished = fileItems.length > 0 && fileItems.every((i) => ["done", "error", "duplicate"].includes(i.status));

  const statusColor = (s: string) =>
    s === "pending" ? "bg-orange-500" : s === "active" ? "bg-blue-500"
    : s === "completed" ? "bg-green-700" : s === "editing" ? "bg-purple-500"
    : s === "selection" ? "bg-cyan-500" : "bg-gray-500";

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  if (isLoading)
    return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" /></div>;

  if (isError)
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 text-red-600">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm font-medium">Failed to load galleries: {error instanceof Error ? error.message : "Unknown error"}</p>
        <button onClick={() => refetch()} className="text-xs underline">Try again</button>
      </div>
    );

  return (
    <div className="space-y-6">
      <Card className="border-green-100">
        <CardHeader className="bg-gradient-to-r from-green-50 to-yellow-50 rounded-t-xl border-b border-green-100">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <ImageIcon className="w-5 h-5" /> Gallery Management
          </CardTitle>
          <CardDescription className="text-green-600">
            Upload photos, organise into folders (e.g. Reception, Ceremony), drag to reorder.
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
                            <span>
                              {gallery.galleryImages?.length || 0} gallery ·{" "}
                              {gallery.selectedImages?.length || 0} selected ·{" "}
                              {gallery.finalImages?.length || 0} final
                            </span>
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
                        <GalleryErrorBoundary>
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
                              onRemoveMany={handleRemoveManyImages}
                              onDedup={handleDedup}
                              onFilesSelected={handleFilesSelected}
                              onPreview={setPreviewImage}
                              activeFolder={activeFolderView[fKey(gallery.id, type)] || ""}
                              uploadFolder={uploadDestFolder[fKey(gallery.id, type)] || ""}
                              newFolderInput={newFolderInputs[fKey(gallery.id, type)] || ""}
                              onFolderView={(folder) => handleFolderView(gallery.id, type, folder)}
                              onUploadFolderChange={(folder) => handleUploadFolderChange(gallery.id, type, folder)}
                              onNewFolderInputChange={(v) => handleNewFolderInputChange(gallery.id, type, v)}
                              onCreateFolder={(name) => handleCreateFolder(gallery, type, name)}
                            />
                          ))}
                        </div>
                        </GalleryErrorBoundary>
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
        <UploadPanel items={fileItems} onClose={closeUploadPanel} canClose={allFinished} onCancel={handleCancel} onRetry={handleRetryFailed} startTime={uploadStartTime} />
      )}

      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-0">
          <img src={previewImage || ""} alt="" className="w-full h-auto max-h-[85vh] object-contain rounded" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
