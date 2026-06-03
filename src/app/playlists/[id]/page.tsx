"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { MediaItem } from "@/components/gallery/Lightbox";
import CustomVideoPlayer from "@/components/gallery/CustomVideoPlayer";
import {
  ArrowLeft,
  Play,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash,
  Loader2,
  Calendar,
  Layers,
  Pause,
  X,
  Volume2,
  VolumeX,
  Maximize2
} from "lucide-react";

interface PlaylistItem {
  id: string;
  order: number;
  media: MediaItem;
}

interface PlaylistDetail {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  autoPlay: boolean;
  speed: number;
  items: PlaylistItem[];
}

export default function PlaylistDetailPage() {
  const params = useParams();
  const playlistId = params.id as string;
  const { user, addNotification } = useApp();
  const router = useRouter();

  // Primary States
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSort, setSavingSort] = useState(false);

  // Add media states
  const [showAddModal, setShowAddModal] = useState(false);
  const [galleryPool, setGalleryPool] = useState<MediaItem[]>([]);
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);

  // Autoplay Slideshow state
  const [isPlayingSlideshow, setIsPlayingSlideshow] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideshowPaused, setSlideshowPaused] = useState(false);
  const [slideshowSpeed, setSlideshowSpeed] = useState(3);
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (user && playlistId) {
      fetchPlaylistDetail();
    }
  }, [user, playlistId]);

  // Slideshow intervals orchestrator
  useEffect(() => {
    if (!isPlayingSlideshow || slideshowPaused || !playlist || playlist.items.length === 0) {
      clearSlideTimer();
      return;
    }

    const currentItem = playlist.items[currentSlideIndex]?.media;
    if (!currentItem) return;

    // If current slide is a video, don't set a timer yet -- let video play to completion!
    if (currentItem.type === "VIDEO") {
      clearSlideTimer();
      return;
    }

    // Set standard image slide timer
    slideTimerRef.current = setTimeout(() => {
      handleNextSlide();
    }, slideshowSpeed * 1000);

    return () => clearSlideTimer();
  }, [isPlayingSlideshow, slideshowPaused, currentSlideIndex, slideshowSpeed, playlist]);

  const clearSlideTimer = () => {
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }
  };

  const fetchPlaylistDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`);
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data.playlist);
        setSlideshowSpeed(data.playlist.speed || 3);
      } else {
        addNotification("Access Denied", "Playlist not found or unauthorized", "warning");
        router.push("/playlists");
      }
    } catch {
      addNotification("Error", "Failed to retrieve playlist details", "error");
    } finally {
      setLoading(false);
    }
  };

  // Re-ordering queue up/down handlers
  const moveItem = async (index: number, direction: "up" | "down") => {
    if (!playlist) return;
    
    const newItems = [...playlist.items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    // Swap items in local array
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Update order indexes
    const updatedItems = newItems.map((item, idx) => ({ ...item, order: idx }));
    setPlaylist({ ...playlist, items: updatedItems });

    // Instantly save to Database to match drag-and-drop backend sync
    await saveNewItemsOrder(updatedItems.map((item) => item.media.id));
  };

  const saveNewItemsOrder = async (orderedMediaIds: string[]) => {
    setSavingSort(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: orderedMediaIds }),
      });

      if (res.ok) {
        addNotification("Success", "Timeline queue re-ordered", "success");
      }
    } catch {
      addNotification("Error", "Failed to save timeline sort", "error");
    } finally {
      setSavingSort(false);
    }
  };

  // Open "Add Media" panel and fetch overall gallery files that are NOT in the playlist
  const handleOpenAddMedia = async () => {
    setShowAddModal(true);
    setLoadingPool(true);
    setSelectedPoolIds([]);

    try {
      const res = await fetch("/api/media");
      if (res.ok) {
        const data = await res.json();
        const allMedia = data.media as MediaItem[];
        
        // Filter unlinked
        const linkedIds = new Set(playlist?.items.map((i) => i.media.id) || []);
        const unlinkedMedia = allMedia.filter((media) => !linkedIds.has(media.id));
        setGalleryPool(unlinkedMedia);
      }
    } catch {
      addNotification("Error", "Failed to load gallery pool", "error");
    } finally {
      setLoadingPool(false);
    }
  };

  // Submit batch add media
  const handleBatchAdd = async () => {
    if (!playlist || selectedPoolIds.length === 0) return;

    try {
      const currentMediaIds = playlist.items.map((i) => i.media.id);
      const combinedMediaIds = [...currentMediaIds, ...selectedPoolIds];

      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: combinedMediaIds }),
      });

      if (res.ok) {
        addNotification("Success", `Added ${selectedPoolIds.length} items to Playlist`, "success");
        setShowAddModal(false);
        fetchPlaylistDetail();
      }
    } catch {
      addNotification("Error", "Failed to add items to playlist", "error");
    }
  };

  // Remove single item from playlist
  const handleRemoveItem = async (mediaId: string) => {
    if (!playlist) return;
    const remainingMediaIds = playlist.items
      .map((i) => i.media.id)
      .filter((id) => id !== mediaId);

    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: remainingMediaIds }),
      });

      if (res.ok) {
        addNotification("Success", "Item removed from playlist", "success");
        fetchPlaylistDetail();
      }
    } catch {
      addNotification("Error", "Failed to remove item", "error");
    }
  };

  // Delete playlist completely
  const handleDeletePlaylist = async () => {
    if (!window.confirm("Are you sure you want to delete this playlist?")) return;
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: "DELETE" });
      if (res.ok) {
        addNotification("Success", "Playlist deleted", "success");
        router.push("/playlists");
      }
    } catch {
      addNotification("Error", "Failed to delete playlist", "error");
    }
  };

  // Slideshow Navigation Handlers
  const handleNextSlide = () => {
    if (!playlist) return;
    if (currentSlideIndex < playlist.items.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      // Loop slideshow to start
      setCurrentSlideIndex(0);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    } else if (playlist) {
      // Loop to end
      setCurrentSlideIndex(playlist.items.length - 1);
    }
  };

  // Video Autostart & End trigger hooks
  const handleVideoPlayEnd = () => {
    handleNextSlide();
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs font-bold animate-pulse">
        <Loader2 className="animate-spin text-primary" size={32} />
        LOADING PLAYLIST TIMELINE...
      </div>
    );
  }

  if (!playlist) return null;

  const currentSlideItem = playlist.items[currentSlideIndex]?.media;

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 relative min-h-[80vh]">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/playlists"
            className="p-2.5 rounded-xl border border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-foreground leading-none">{playlist.name}</h1>
            <p className="text-xs text-muted-foreground">
              {playlist.description || "Visual slideshow presentation builder."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleDeletePlaylist}
            className="p-2.5 rounded-xl border border-destructive/20 hover:bg-destructive/15 text-destructive cursor-pointer transition-colors shadow-sm shrink-0"
            title="Delete playlist"
          >
            <Trash size={16} />
          </button>

          <button
            onClick={handleOpenAddMedia}
            className="flex items-center gap-1.5 border border-border/80 hover:border-primary/45 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-bold px-3 py-2.5 sm:px-4.5 sm:py-2.5 rounded-xl cursor-pointer hover:shadow transition-all shrink-0"
            title="Add Media"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Add Media</span>
          </button>

          <button
            onClick={() => {
              if (playlist.items.length === 0) {
                addNotification("Notice", "Add media items to trigger slideshow", "warning");
                return;
              }
              setCurrentSlideIndex(0);
              setSlideshowPaused(false);
              setIsPlayingSlideshow(true);
            }}
            disabled={playlist.items.length === 0}
            className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white text-xs font-bold px-3.5 py-2.5 sm:px-5 sm:py-2.5 rounded-xl cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-98 disabled:opacity-50 shrink-0"
            title="Play Slideshow"
          >
            <Play size={14} fill="currentColor" />
            <span className="hidden sm:inline">Play Slideshow</span>
            <span className="sm:hidden">Play</span>
          </button>
        </div>
      </div>

      {/* 2. Timeline items scroller list */}
      {playlist.items.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-card/10 border-2 border-dashed border-border/60 rounded-3xl">
          <Layers size={36} className="text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-extrabold text-foreground mb-1">Playlist timeline empty</h3>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            Drag and drop images and videos from your gallery to construct a transition sequence.
          </p>
          <button
            onClick={handleOpenAddMedia}
            className="mt-6 border border-border/80 hover:border-primary/40 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold px-4.5 py-2.5 rounded-xl cursor-pointer hover:shadow transition-all"
          >
            Select Photos Now
          </button>
        </div>
      ) : (
        <div className="space-y-3 pb-24">
          <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
            <Layers size={13} className="text-primary" /> Slide Presentation Timeline ({playlist.items.length} items)
          </span>

          <div className="space-y-2">
            {playlist.items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 glass border border-border/60 hover:border-primary/30 rounded-2xl transition-all shadow-sm group bg-card/10"
              >
                <div className="flex items-center gap-4 truncate">
                  {/* Visual timeline order counter */}
                  <span className="text-xs font-black text-muted-foreground w-6 text-center shrink-0">
                    {index + 1}
                  </span>

                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl border border-border bg-secondary overflow-hidden shrink-0">
                    {item.media.type === "IMAGE" ? (
                      <img src={item.media.url} className="w-full h-full object-cover" />
                    ) : (
                      <video src={item.media.url} className="w-full h-full object-cover" muted />
                    )}
                  </div>

                  <div className="truncate pr-4">
                    <p className="text-xs font-bold text-foreground truncate max-w-[280px]">{item.media.filename}</p>
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wide">
                      {item.media.type} • {(item.media.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                </div>

                {/* Operations (Re-ordering Up/Down and Delete links) */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => moveItem(index, "up")}
                    disabled={index === 0 || savingSort}
                    className="p-2 rounded-lg bg-secondary/40 border border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                    title="Move up"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    onClick={() => moveItem(index, "down")}
                    disabled={index === playlist.items.length - 1 || savingSort}
                    className="p-2 rounded-lg bg-secondary/40 border border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-30"
                    title="Move down"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    onClick={() => handleRemoveItem(item.media.id)}
                    className="p-2 rounded-lg bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 text-rose-500 cursor-pointer ml-3"
                    title="Remove item"
                  >
                    <Trash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Playlist Add Media Grid dialog popover */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[85vh] glass rounded-3xl p-6 border border-border shadow-2xl flex flex-col justify-between animate-in zoom-in-95 duration-200">
            <div>
              <h2 className="text-base font-black text-foreground mb-1">Select Media Pool</h2>
              <p className="text-[10px] text-muted-foreground pb-4 border-b border-border/60">
                Choose photos or video streams from your core gallery to append inside the slideshow play queue.
              </p>
            </div>

            {/* List pool scroller */}
            <div className="flex-1 overflow-y-auto py-4">
              {loadingPool ? (
                <div className="h-48 flex items-center justify-center text-xs font-bold text-muted-foreground animate-pulse gap-2">
                  <Loader2 className="animate-spin text-primary" size={20} /> Loading gallery pool...
                </div>
              ) : galleryPool.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground font-medium">
                  All gallery items are already inside this playlist.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {galleryPool.map((item) => {
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
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-foreground font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBatchAdd}
                  disabled={selectedPoolIds.length === 0}
                  className="px-4.5 py-2 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  Append selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Fullscreen mixed-media interactive Auto-play slideshow player */}
      {isPlayingSlideshow && currentSlideItem && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col justify-between overflow-hidden select-none select-none animate-in fade-in duration-300">
          {/* Top controller navbar */}
          <div className="p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white relative z-10">
            <div className="text-left">
              <h2 className="text-sm font-black truncate max-w-[220px]">{playlist.name}</h2>
              <span className="text-[9px] text-white/50 uppercase font-extrabold tracking-widest mt-0.5 inline-block">
                Slide {currentSlideIndex + 1} of {playlist.items.length}
              </span>
            </div>

            {/* Speeds and playback toggles */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-white/70">
                <span className="text-[8px] font-bold uppercase tracking-wider hidden sm:inline">Delay: {slideshowSpeed}s</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={slideshowSpeed}
                  onChange={(e) => setSlideshowSpeed(Number(e.target.value))}
                  className="w-16 sm:w-20 accent-primary h-1 rounded bg-white/20 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setSlideshowPaused(!slideshowPaused)}
                  className="p-3 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-95 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title={slideshowPaused ? "Resume autoplay" : "Pause autoplay"}
                >
                  {slideshowPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}
                </button>
                <button
                  onClick={() => setIsPlayingSlideshow(false)}
                  className="p-3 sm:p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-500 cursor-pointer active:scale-95 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
                  title="Close presentation"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Core Player Area */}
          <div className="flex-1 flex items-center justify-center relative p-8">
            {/* Custom linear progress line indicating current slide time */}
            {currentSlideItem.type === "IMAGE" && !slideshowPaused && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-20">
                <div
                  key={currentSlideIndex} // Key reset animation on slide change
                  className="h-full bg-primary"
                  style={{
                    animation: `slideshowProgress ${slideshowSpeed}s linear forwards`
                  }}
                />
              </div>
            )}

            {/* Custom animations styling injection */}
            <style jsx global>{`
              @keyframes slideshowProgress {
                from { width: 0%; }
                to { width: 100%; }
              }
            `}</style>

            {currentSlideItem.type === "IMAGE" ? (
              <div className="relative">
                <img
                  src={currentSlideItem.url}
                  alt={currentSlideItem.filename}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl transition-all duration-500 ease-out"
                />
              </div>
            ) : (
              <CustomVideoPlayer
                src={currentSlideItem.url}
                autoPlay
                onEnded={handleVideoPlayEnd}
                filename={currentSlideItem.filename}
                className="max-w-full max-h-[80vh] shadow-2xl"
              />
            )}
          </div>

          {/* Bottom quick navigation arrows bar */}
          <div className="p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-4 sm:gap-6 text-white relative z-10 w-full">
            <button
              onClick={handlePrevSlide}
              className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-3 sm:py-2 rounded-xl active:scale-95 transition-all cursor-pointer min-w-[44px]"
            >
              Prev
            </button>
            <span className="text-[11px] font-black text-white/80 select-none truncate max-w-[150px] sm:max-w-xs">
              {currentSlideItem.filename}
            </span>
            <button
              onClick={handleNextSlide}
              className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-3 sm:py-2 rounded-xl active:scale-95 transition-all cursor-pointer min-w-[44px]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
