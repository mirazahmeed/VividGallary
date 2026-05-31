"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import Lightbox, { MediaItem } from "@/components/gallery/Lightbox";
import {
  FolderOpen,
  ArrowLeft,
  Trash2,
  FolderHeart,
  Plus,
  Users,
  Grid,
  Image as PhotoIcon,
  Video as VideoIcon,
  Loader2,
  Trash,
  UserCheck,
  Lock,
  Globe,
  Key
} from "lucide-react";

interface Collaborator {
  id: string;
  role: string;
  user: { id: string; name: string | null; email: string };
}

interface AlbumDetail {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  userId: string;
  user: { name: string | null; email: string };
  coverMediaId: string | null;
  children: Array<{
    id: string;
    name: string;
    description: string | null;
    _count: { media: number };
    coverMedia: { url: string } | null;
  }>;
  permissions: Collaborator[];
  media: Array<{ addedAt: string; media: MediaItem }>;
}

export default function AlbumDetailPage() {
  const params = useParams();
  const albumId = params.id as string;
  const { user, addNotification } = useApp();
  const router = useRouter();

  // Page States
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Add media dialog states
  const [showAddMediaModal, setShowAddMediaModal] = useState(false);
  const [globalMediaPool, setGlobalMediaPool] = useState<MediaItem[]>([]);
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);

  // Nested Album subfolder states
  const [showCreateSubfolderModal, setShowCreateSubfolderModal] = useState(false);
  const [subfolderName, setSubfolderName] = useState("");
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);

  // Lightbox index state
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (user && albumId) {
      fetchAlbumDetail();
    }
  }, [user, albumId]);

  const fetchAlbumDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/albums/${albumId}`);
      if (res.ok) {
        const data = await res.json();
        setAlbum(data.album);
      } else {
        addNotification("Access Denied", "Folder access denied or requires verification", "warning");
        router.push("/albums");
      }
    } catch {
      addNotification("Error", "Failed to retrieve album detail", "error");
    } finally {
      setLoading(false);
    }
  };

  // Open "Add Media" panel and fetch overall gallery files that are NOT in the album
  const handleOpenAddMedia = async () => {
    setShowAddMediaModal(true);
    setLoadingPool(true);
    setSelectedPoolIds([]);

    try {
      // 1. Fetch all user media files
      const res = await fetch("/api/media");
      if (res.ok) {
        const data = await res.json();
        const allMedia = data.media as MediaItem[];
        
        // 2. Filter out files that are already linked in this album
        const linkedIds = new Set(album?.media.map((m) => m.media.id) || []);
        const unlinkedMedia = allMedia.filter((media) => !linkedIds.has(media.id));
        setGlobalMediaPool(unlinkedMedia);
      }
    } catch {
      addNotification("Error", "Failed to load gallery pool", "error");
    } finally {
      setLoadingPool(false);
    }
  };

  // Submit batch add media linking
  const handleBatchAddMedia = async () => {
    if (selectedPoolIds.length === 0) return;

    try {
      const res = await fetch(`/api/albums/${albumId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: selectedPoolIds }),
      });

      if (res.ok) {
        addNotification("Success", `Added ${selectedPoolIds.length} items to Album`, "success");
        setShowAddMediaModal(false);
        fetchAlbumDetail();
      }
    } catch {
      addNotification("Error", "Failed to link items to album", "error");
    }
  };

  // Remove files from Album (batch deletion of join table links)
  const handleRemoveMedia = async () => {
    if (selectedMediaIds.length === 0) return;

    try {
      const res = await fetch(`/api/albums/${albumId}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: selectedMediaIds }),
      });

      if (res.ok) {
        addNotification("Success", `Removed ${selectedMediaIds.length} items from Album`, "success");
        setSelectedMediaIds([]);
        setIsSelectMode(false);
        fetchAlbumDetail();
      }
    } catch {
      addNotification("Error", "Failed to unlink items", "error");
    }
  };

  // Create child subfolder (nested album!)
  const handleCreateSubfolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subfolderName.trim()) return;

    setCreatingSubfolder(true);
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subfolderName,
          description: `Subfolder of ${album?.name}`,
          visibility: album?.visibility || "PRIVATE",
          parentId: albumId,
        }),
      });

      if (res.ok) {
        addNotification("Success", `Sub-album "${subfolderName}" initialized`, "success");
        setSubfolderName("");
        setShowCreateSubfolderModal(false);
        fetchAlbumDetail();
      }
    } catch {
      addNotification("Error", "Failed to construct sub-album", "error");
    } finally {
      setCreatingSubfolder(false);
    }
  };

  // Delete dynamic album entirely
  const handleDeleteAlbum = async () => {
    if (!window.confirm("Are you sure you want to delete this album? (Your media files will NOT be deleted from the database).")) return;
    try {
      const res = await fetch(`/api/albums/${albumId}`, { method: "DELETE" });
      if (res.ok) {
        addNotification("Success", "Album deleted", "success");
        router.push("/albums");
      }
    } catch {
      addNotification("Error", "Failed to delete album", "error");
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs font-bold animate-pulse">
        <Loader2 className="animate-spin text-primary" size={32} />
        LOADING ALBUM DETAILS...
      </div>
    );
  }

  if (!album) return null;

  const isOwner = album.userId === user?.id;

  const getVisibilityBadge = (mode: string) => {
    switch (mode) {
      case "PUBLIC":
        return (
          <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold px-3 py-1 rounded-full shrink-0">
            <Globe size={11} /> Public Access
          </span>
        );
      case "PASSWORD_PROTECTED":
        return (
          <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold px-3 py-1 rounded-full shrink-0">
            <Key size={11} /> Password Challenged
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 bg-muted/60 border border-border/40 text-muted-foreground text-[10px] font-bold px-3 py-1 rounded-full shrink-0">
            <Lock size={11} /> Private Folder
          </span>
        );
    }
  };

  const albumMediaItems = album.media.map((m) => m.media);

  // Lightbox helpers
  const activeLightboxItem = activeLightboxIndex !== null ? albumMediaItems[activeLightboxIndex] : null;

  const handlePrevLightbox = () => {
    if (activeLightboxIndex !== null && activeLightboxIndex > 0) {
      setActiveLightboxIndex(activeLightboxIndex - 1);
    }
  };

  const handleNextLightbox = () => {
    if (activeLightboxIndex !== null && activeLightboxIndex < albumMediaItems.length - 1) {
      setActiveLightboxIndex(activeLightboxIndex + 1);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 relative min-h-[80vh]">
      {/* 1. Top Navbar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/albums"
            className="p-2.5 rounded-xl border border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black text-foreground leading-none">{album.name}</h1>
              {getVisibilityBadge(album.visibility)}
            </div>
            <p className="text-xs text-muted-foreground">
              {album.description || "No description cataloged for this collection."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={handleDeleteAlbum}
              className="p-2.5 rounded-xl border border-destructive/20 hover:bg-destructive/15 text-destructive cursor-pointer transition-colors shadow-sm"
              title="Delete folder"
            >
              <Trash size={16} />
            </button>
          )}

          <button
            onClick={() => setIsSelectMode(!isSelectMode)}
            className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
              isSelectMode
                ? "bg-primary/10 border-primary/40 text-primary animate-pulse"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {isSelectMode ? "Selection Mode" : "Select Items"}
          </button>

          <button
            onClick={() => setShowCreateSubfolderModal(true)}
            className="flex items-center gap-1.5 border border-border/80 hover:border-primary/45 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-bold px-4.5 py-2.5 rounded-xl cursor-pointer hover:shadow transition-all"
          >
            <Plus size={14} /> Subfolder
          </button>

          <button
            onClick={handleOpenAddMedia}
            className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white text-xs font-bold px-4.5 py-2.5 rounded-xl cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-98"
          >
            <Plus size={14} /> Add Photos
          </button>
        </div>
      </div>

      {/* 2. Collaborative Invitees summary banner */}
      {album.permissions.length > 0 && (
        <div className="p-3.5 bg-purple-500/5 border border-purple-500/10 rounded-2xl flex items-center justify-between text-xs max-w-lg shadow-sm">
          <div className="flex items-center gap-2 text-purple-600 font-semibold dark:text-purple-400">
            <Users size={16} /> Shared Album Collaborators
          </div>
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            {album.permissions.map((p) => (
              <span
                key={p.id}
                className="bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full text-[10px]"
                title={`${p.user.email} (${p.role})`}
              >
                {p.user.name || p.user.email.substring(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Render Nested folders sub-albums (If any!) */}
      {album.children.length > 0 && (
        <div className="space-y-3">
          <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
            <FolderOpen size={13} className="text-primary" /> Nested Subfolders
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {album.children.map((child) => (
              <Link
                key={child.id}
                href={`/albums/${child.id}`}
                className="flex items-center gap-3.5 p-3.5 bg-card/45 hover:bg-secondary/40 border border-border/60 hover:border-primary/45 rounded-2xl transition-all shadow-sm group hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <FolderHeart size={18} />
                </div>
                <div className="truncate pr-2">
                  <h4 className="text-[11px] font-extrabold text-foreground truncate group-hover:text-primary transition-colors">
                    {child.name}
                  </h4>
                  <span className="text-[9px] text-muted-foreground font-semibold">
                    {child._count.media} items
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 4. Masonry Grid of items inside album */}
      {album.media.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-card/10 border-2 border-dashed border-border/60 rounded-3xl">
          <Grid size={36} className="text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-extrabold text-foreground mb-1">No items in album</h3>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            Start linking items from your primary gallery collection into this album.
          </p>
          <button
            onClick={handleOpenAddMedia}
            className="mt-6 border border-border/80 hover:border-primary/40 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold px-4.5 py-2.5 rounded-xl cursor-pointer hover:shadow transition-all"
          >
            Add Photos Now
          </button>
        </div>
      ) : (
        <div className="masonry-grid pb-24">
          {album.media.map((joint, index) => {
            const item = joint.media;
            const isSelected = selectedMediaIds.includes(item.id);
            const heightClass = index % 3 === 0 ? "h-64" : index % 2 === 0 ? "h-80" : "h-72";

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isSelectMode) {
                    setSelectedMediaIds((prev) =>
                      prev.includes(item.id)
                        ? prev.filter((id) => id !== item.id)
                        : [...prev, item.id]
                    );
                  } else {
                    setActiveLightboxIndex(index);
                  }
                }}
                className={`group relative overflow-hidden rounded-2xl cursor-pointer shadow-md transition-all duration-300 border bg-secondary/20 hover:scale-[1.015] hover:shadow-xl ${heightClass} ${
                  isSelected ? "border-primary/80 ring-2 ring-primary/30" : "border-border/60"
                }`}
              >
                {/* Media Image/Video */}
                {item.type === "IMAGE" ? (
                  <img
                    src={item.url}
                    alt={item.filename}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full relative group-hover:scale-105 transition-transform duration-500">
                    <video src={item.url} className="w-full h-full object-cover pointer-events-none" muted />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white border border-white/10 group-hover:scale-110 transition-transform">
                        <VideoIcon size={16} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Multiselect Checkbox overlay */}
                {(isSelectMode || isSelected) && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMediaIds((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((id) => id !== item.id)
                          : [...prev, item.id]
                      );
                    }}
                    className="absolute top-3 left-3 p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white z-10 hover:scale-105 active:scale-95 transition-transform"
                  >
                    {isSelected ? (
                      <span className="w-4.5 h-4.5 rounded bg-primary flex items-center justify-center text-[10px] font-black text-white">✓</span>
                    ) : (
                      <span className="w-4.5 h-4.5 rounded border border-white/60 block" />
                    )}
                  </div>
                )}

                {/* Hover overlay details */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                  <p className="text-[11px] font-bold text-white truncate leading-none mb-1">
                    {item.filename}
                  </p>
                  <span className="text-[9px] text-white/60 font-semibold">
                    Added: {new Date(joint.addedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Selection Mode Floating Action Drawer (Remove from Album) */}
      {isSelectMode && selectedMediaIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass border border-border/80 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6 z-40 animate-in slide-in-from-bottom-5 duration-300 max-w-[90vw] sm:max-w-md">
          <div className="text-xs font-bold text-foreground border-r border-border pr-5 shrink-0">
            Selected: <span className="text-primary">{selectedMediaIds.length}</span>
          </div>

          <button
            onClick={handleRemoveMedia}
            className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-xs font-bold text-rose-500 px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-98 w-full justify-center"
          >
            <Trash2 size={14} /> Remove from Album
          </button>
        </div>
      )}

      {/* 6. Dynamic "Add Media to Album" Grid dialog popover */}
      {showAddMediaModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[85vh] glass rounded-3xl p-6 border border-border shadow-2xl flex flex-col justify-between animate-in zoom-in-95 duration-200">
            <div>
              <h2 className="text-base font-black text-foreground mb-1">Select Media Files</h2>
              <p className="text-[10px] text-muted-foreground pb-4 border-b border-border/60">
                Choose photos or video streams from your core gallery to link inside this album folder.
              </p>
            </div>

            {/* List pool scroller */}
            <div className="flex-1 overflow-y-auto py-4">
              {loadingPool ? (
                <div className="h-48 flex items-center justify-center text-xs font-bold text-muted-foreground animate-pulse gap-2">
                  <Loader2 className="animate-spin text-primary" size={20} /> Loading gallery pool...
                </div>
              ) : globalMediaPool.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground font-medium">
                  All gallery items are already linked inside this album.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {globalMediaPool.map((item) => {
                    const isSelected = selectedPoolIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedPoolIds((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((id) => id !== item.id)
                              : [...prev, item.id]
                          );
                        }}
                        className={`aspect-square relative rounded-xl border overflow-hidden cursor-pointer shadow hover:scale-[1.01] hover:shadow-md transition-all ${
                          isSelected ? "border-primary/80 ring-2 ring-primary/20" : "border-border/60"
                        }`}
                      >
                        {item.type === "IMAGE" ? (
                          <img src={item.url} className="w-full h-full object-cover" />
                        ) : (
                          <video src={item.url} className="w-full h-full object-cover" muted />
                        )}

                        {/* Checkbox indicator */}
                        <div className="absolute top-2 left-2 p-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10 text-white">
                          {isSelected ? (
                            <span className="w-3.5 h-3.5 rounded bg-primary flex items-center justify-center text-[8px] font-black text-white">✓</span>
                          ) : (
                            <span className="w-3.5 h-3.5 rounded border border-white/60 block" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-bold text-muted-foreground">
                Selected: <span className="text-primary">{selectedPoolIds.length} items</span>
              </span>

              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowAddMediaModal(false)}
                  className="px-4 py-2 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-foreground font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchAddMedia}
                  disabled={selectedPoolIds.length === 0}
                  className="px-4.5 py-2 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  Link selected files
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. New Subfolder Modal overlay popover */}
      {showCreateSubfolderModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-sm glass rounded-3xl p-6 border border-border shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-black text-foreground mb-4">Initialize Subfolder Album</h2>
            
            <form onSubmit={handleCreateSubfolder} className="space-y-4">
              <div>
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Subfolder Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Day 1 Excursions"
                  value={subfolderName}
                  onChange={(e) => setSubfolderName(e.target.value)}
                  className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-border/40 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateSubfolderModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-foreground font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSubfolder}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-xs shadow cursor-pointer disabled:opacity-50 flex items-center justify-center"
                >
                  {creatingSubfolder ? <Loader2 className="animate-spin" size={16} /> : "Create Subfolder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Lightbox modal */}
      {activeLightboxIndex !== null && (
        <Lightbox
          media={activeLightboxItem}
          onClose={() => setActiveLightboxIndex(null)}
          onPrev={activeLightboxIndex > 0 ? handlePrevLightbox : undefined}
          onNext={activeLightboxIndex < albumMediaItems.length - 1 ? handleNextLightbox : undefined}
          onUpdate={fetchAlbumDetail}
        />
      )}
    </div>
  );
}
