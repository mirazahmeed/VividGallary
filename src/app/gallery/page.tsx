"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import Lightbox, { MediaItem } from "@/components/gallery/Lightbox";
import Slideshow from "@/components/gallery/Slideshow";
import {
  Image as PhotoIcon,
  Video as VideoIcon,
  Heart,
  Archive,
  Trash2,
  CheckSquare,
  Square,
  FolderPlus,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  Globe,
  Lock,
  RotateCcw,
  Download,
  Play
} from "lucide-react";

export default function GalleryPage() {
  const { user, searchQuery, addNotification } = useApp();
  const searchParams = useSearchParams();
 
  // Swipe selection refs
  const isSwipeSelectingRef = useRef(false);
  const swipeModeRef = useRef<"select" | "deselect">("select");

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isSwipeSelectingRef.current = false;
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Primary states
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters states
  const [activeType, setActiveType] = useState<string>("ALL"); // ALL, IMAGE, VIDEO
  const [viewState, setViewState] = useState<string>("GALLERY"); // GALLERY, FAVORITE, ARCHIVE, TRASH
  
  // Selection states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [userAlbums, setUserAlbums] = useState<Array<{ id: string; name: string }>>([]);
  const [showAlbumDropdown, setShowAlbumDropdown] = useState(false);
  const [isPlayingSlideshow, setIsPlayingSlideshow] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const handleDownloadSelected = async () => {
    if (selectedIds.length === 0) return;
    setDownloadingZip(true);
    addNotification("Archiving", `Creating ZIP archive for ${selectedIds.length} items...`, "info");
    try {
      const res = await fetch("/api/media/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate ZIP");
      }

      // Convert to blob and trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vividgallery_batch_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addNotification("Download Complete", "ZIP file download started", "success");
      setSelectedIds([]);
      setIsSelectMode(false);
    } catch (err) {
      console.error(err);
      addNotification("Download Failed", "Could not generate ZIP package", "error");
    } finally {
      setDownloadingZip(false);
    }
  };

  // Lightbox states
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);

  // Parse URL query parameter for direct landing filters (e.g. from Dashboard counter cards!)
  useEffect(() => {
    const urlType = searchParams.get("type");
    if (urlType === "IMAGE" || urlType === "VIDEO") {
      setActiveType(urlType);
    }
  }, [searchParams]);

  // Load and refresh media list dynamically
  useEffect(() => {
    if (user) {
      fetchMedia();
      fetchUserAlbums();
    }
  }, [user, activeType, viewState, searchQuery]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      let url = `/api/media?type=${activeType !== "ALL" ? activeType : ""}`;
      if (viewState === "FAVORITE") url += "&favorite=true";
      if (viewState === "ARCHIVE") url += "&archived=true";
      if (viewState === "TRASH") url += "&trash=true";
      if (searchQuery) url += `&search=${searchQuery}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMediaItems(data.media);
      }
    } catch {
      addNotification("Error", "Failed to fetch gallery media", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAlbums = async () => {
    try {
      const res = await fetch("/api/albums");
      if (res.ok) {
        const data = await res.json();
        setUserAlbums(data.albums.map((a: any) => ({ id: a.id, name: a.name })));
      }
    } catch {
      // Background failure safe
    }
  };

  // Perform bulk operations
  const handleBulkAction = async (action: string, albumId?: string) => {
    if (selectedIds.length === 0) return;

    try {
      const isPermanentDelete = viewState === "TRASH" && action === "TRASH";
      const endpoint = isPermanentDelete ? "/api/media" : "/api/media";
      const method = isPermanentDelete ? "DELETE" : "PUT";
      const body: any = isPermanentDelete ? { ids: selectedIds } : { ids: selectedIds, action, albumId };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addNotification(
          "Success",
          isPermanentDelete
            ? `Permanently deleted ${selectedIds.length} items`
            : `Bulk operation applied successfully`,
          "success"
        );
        setSelectedIds([]);
        setIsSelectMode(false);
        fetchMedia();
      }
    } catch {
      addNotification("Error", "Failed to execute bulk operation", "error");
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } else {
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === mediaItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(mediaItems.map((item) => item.id));
    }
  };

  // Lightbox navigations
  const activeLightboxItem = activeLightboxIndex !== null ? mediaItems[activeLightboxIndex] : null;

  const handlePrevLightbox = () => {
    if (activeLightboxIndex !== null && activeLightboxIndex > 0) {
      setActiveLightboxIndex(activeLightboxIndex - 1);
    }
  };

  const handleNextLightbox = () => {
    if (activeLightboxIndex !== null && activeLightboxIndex < mediaItems.length - 1) {
      setActiveLightboxIndex(activeLightboxIndex + 1);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300 relative min-h-[80vh]">
      {/* 1. Filter and Navigation Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-border/60 pb-4 sm:pb-5">
        {/* Navigation Categories */}
        <div className="flex overflow-x-auto scrollbar-none whitespace-nowrap gap-1 bg-secondary/40 p-1 border border-border/40 rounded-2xl max-w-full">
          {[
            { label: "Gallery", state: "GALLERY" },
            { label: "Favorites", state: "FAVORITE" },
            { label: "Archive", state: "ARCHIVE" },
            { label: "Trash Bin", state: "TRASH" },
          ].map((tab) => (
            <button
              key={tab.state}
              onClick={() => {
                setViewState(tab.state);
                setSelectedIds([]);
                setIsSelectMode(false);
              }}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
                viewState === tab.state
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Media type selectors & select mode trigger */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3.5">
          {/* Mimetype category filters */}
          <div className="flex border border-border/60 bg-muted/20 p-1 rounded-xl shrink-0">
            {[
              { label: "All", type: "ALL" },
              { label: "Photos", type: "IMAGE" },
              { label: "Videos", type: "VIDEO" },
            ].map((type) => (
              <button
                key={type.type}
                onClick={() => {
                  setActiveType(type.type);
                  setSelectedIds([]);
                }}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                  activeType === type.type
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Multiselect toggle */}
          <button
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 border text-xs font-bold px-3.5 py-2.5 sm:px-4.5 sm:py-2.5 rounded-xl transition-all cursor-pointer ${
              isSelectMode
                ? "bg-primary/10 border-primary/40 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <SlidersHorizontal size={14} /> {isSelectMode ? "Selection: Active" : "Select Items"}
          </button>

          {/* Select All Toggle */}
          {isSelectMode && mediaItems.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 border border-border/60 text-xs font-bold px-3.5 py-2.5 sm:px-4.5 sm:py-2.5 rounded-xl text-muted-foreground hover:text-foreground transition-all cursor-pointer bg-muted/20"
            >
              {selectedIds.length === mediaItems.length ? (
                <>
                  <Square size={14} /> Deselect All
                </>
              ) : (
                <>
                  <CheckSquare size={14} /> Select All
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. Gallery Masonry Render list */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs font-bold animate-pulse">
          <Loader2 className="animate-spin text-primary" size={32} />
          LOADING GALLERY FILES...
        </div>
      ) : mediaItems.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-card/10 border-2 border-dashed border-border/60 rounded-3xl">
          <SlidersHorizontal size={36} className="text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-extrabold text-foreground mb-1">No media files found</h3>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            {searchQuery
              ? "No files match your query in this category."
              : "Upload photos or video streams to initialize your media catalog."}
          </p>
        </div>
      ) : (
        <div className="masonry-grid pb-24">
          {mediaItems.map((item, index) => {
            const isSelected = selectedIds.includes(item.id);
            // Stagger size styles for dynamic premium masonry layout
            const heightClass = index % 3 === 0 ? "h-64" : index % 2 === 0 ? "h-80" : "h-72";

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!isSelectMode) {
                    setActiveLightboxIndex(index);
                  }
                }}
                onMouseDown={(e) => {
                  if (isSelectMode) {
                    e.preventDefault();
                    isSwipeSelectingRef.current = true;
                    const isSelected = selectedIds.includes(item.id);
                    if (isSelected) {
                      swipeModeRef.current = "deselect";
                      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                    } else {
                      swipeModeRef.current = "select";
                      setSelectedIds((prev) => [...prev, item.id]);
                    }
                  }
                }}
                onMouseEnter={() => {
                  if (isSelectMode && isSwipeSelectingRef.current) {
                    const isSelected = selectedIds.includes(item.id);
                    if (swipeModeRef.current === "select" && !isSelected) {
                      setSelectedIds((prev) => [...prev, item.id]);
                    } else if (swipeModeRef.current === "deselect" && isSelected) {
                      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                    }
                  }
                }}
                className={`group relative overflow-hidden rounded-2xl cursor-pointer shadow-md transition-all duration-300 border bg-secondary/20 hover:scale-[1.015] hover:shadow-xl ${heightClass} ${
                  isSelected ? "border-primary/80 ring-2 ring-primary/30" : "border-border/60"
                }`}
              >
                {/* Media Node image/video thumbnail preview */}
                {item.type === "IMAGE" ? (
                  <img
                    src={item.url}
                    alt={item.filename}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                ) : (
                  <div className="w-full h-full relative group-hover:scale-105 transition-transform duration-500">
                    <video
                      src={`${item.url}#t=0.1`}
                      className="w-full h-full object-cover pointer-events-none"
                      muted
                      preload="metadata"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/45 backdrop-blur-md flex items-center justify-center text-white border border-white/10 group-hover:scale-110 transition-transform">
                        <VideoIcon size={16} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Status Badges (Top right) */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
                  {item.isFavorite && (
                    <div className="p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-rose-500 shadow">
                      <Heart size={13} fill="currentColor" />
                    </div>
                  )}
                  {item.visibility === "PUBLIC" ? (
                    <div className="p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-emerald-400 shadow" title="Publicly Shared">
                      <Globe size={13} />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-amber-500 shadow" title="Private">
                      <Lock size={13} />
                    </div>
                  )}
                </div>

                {/* Multiselect Checkbox layer */}
                {(isSelectMode || isSelected) && (
                  <div
                    onClick={(e) => toggleSelect(item.id, e)}
                    className="absolute top-3 left-3 p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white z-10 hover:scale-105 active:scale-95 transition-transform"
                  >
                    {isSelected ? (
                      <CheckSquare size={15} className="text-primary" />
                    ) : (
                      <Square size={15} className="text-white/60" />
                    )}
                  </div>
                )}

                {/* Hover overlay filename details (Bottom side) */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end">
                  <p className="text-[11px] font-bold text-white truncate leading-none mb-1">
                    {item.filename}
                  </p>
                  <span className="text-[9px] text-white/60 font-semibold">
                    {new Date(item.createdAt).toLocaleDateString()} • {(item.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Floating Batch Action Drawer (Visible only in selection mode) */}
      {isSelectMode && selectedIds.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 glass border border-border/80 rounded-2xl shadow-2xl px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-6 z-40 animate-in slide-in-from-bottom-5 duration-300 max-w-[90vw] sm:max-w-2xl">
          <div className="text-xs font-bold text-foreground sm:border-r sm:border-border sm:pr-5 shrink-0">
            Selected: <span className="text-primary">{selectedIds.length}</span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            {/* Batch Favorite */}
            {viewState !== "TRASH" && (
              <button
                onClick={() => handleBulkAction("FAVORITE")}
                className="flex items-center gap-1.5 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border/60 transition-colors cursor-pointer"
              >
                <Heart size={14} /> Favorite
              </button>
            )}

            {/* Batch Archive */}
            {viewState !== "TRASH" && viewState !== "ARCHIVE" && (
              <button
                onClick={() => handleBulkAction("ARCHIVE")}
                className="flex items-center gap-1.5 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border/60 transition-colors cursor-pointer"
              >
                <Archive size={14} /> Archive
              </button>
            )}

            {/* Batch Make Public */}
            {viewState !== "TRASH" && (
              <button
                onClick={() => handleBulkAction("MAKE_PUBLIC")}
                className="flex items-center gap-1.5 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border/60 transition-colors cursor-pointer"
              >
                <Globe size={14} /> Make Public
              </button>
            )}

            {/* Batch Make Private */}
            {viewState !== "TRASH" && (
              <button
                onClick={() => handleBulkAction("MAKE_PRIVATE")}
                className="flex items-center gap-1.5 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border/60 transition-colors cursor-pointer"
              >
                <Lock size={14} /> Make Private
              </button>
            )}

            {/* Batch Add to Album Trigger */}
            {viewState !== "TRASH" && (
              <div className="relative">
                <button
                  onClick={() => setShowAlbumDropdown(!showAlbumDropdown)}
                  className="flex items-center gap-1.5 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border/60 transition-colors cursor-pointer"
                >
                  <FolderPlus size={14} /> Album <ChevronDown size={12} />
                </button>

                {showAlbumDropdown && (
                  <div className="absolute bottom-12 left-0 w-48 rounded-xl border border-border bg-card shadow-2xl py-1.5 overflow-hidden z-50 flex flex-col animate-in fade-in duration-200">
                    <span className="text-[9px] font-extrabold text-muted-foreground px-3 py-1.5 uppercase block border-b border-border/40">
                      Add selected to:
                    </span>
                    <div className="max-h-36 overflow-y-auto divide-y divide-border/20">
                      {userAlbums.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground p-3 block">No albums found</span>
                      ) : (
                        userAlbums.map((alb) => (
                          <button
                            key={alb.id}
                            onClick={() => {
                              handleBulkAction("ADD_TO_ALBUM", alb.id);
                              setShowAlbumDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] font-bold text-foreground hover:bg-secondary/60 transition-colors cursor-pointer truncate"
                          >
                            {alb.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Batch Play Slideshow */}
            {viewState !== "TRASH" && (
              <button
                onClick={() => setIsPlayingSlideshow(true)}
                className="flex items-center gap-1.5 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border/60 transition-colors cursor-pointer"
              >
                <Play size={14} fill="currentColor" /> Play Slideshow
              </button>
            )}

            {/* Batch Download ZIP */}
            {viewState !== "TRASH" && (
              <button
                onClick={handleDownloadSelected}
                disabled={downloadingZip}
                className="flex items-center gap-1.5 hover:bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                {downloadingZip ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-primary" /> Archiving...
                  </>
                ) : (
                  <>
                    <Download size={14} /> Download ZIP
                  </>
                )}
              </button>
            )}

            {/* Batch Restore */}
            {viewState === "TRASH" && (
              <button
                onClick={() => handleBulkAction("RESTORE")}
                className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 hover:bg-primary/25 text-xs font-bold text-primary px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <RotateCcw size={14} /> Restore Files
              </button>
            )}

            {/* Batch Trash / Permanent Delete */}
            <button
              onClick={() => handleBulkAction(viewState === "TRASH" ? "TRASH" : "TRASH")}
              className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 hover:bg-destructive/25 text-xs font-bold text-destructive px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm active:scale-98"
            >
              <Trash2 size={14} /> {viewState === "TRASH" ? "Delete Permanently" : "Move to Trash"}
            </button>
          </div>
        </div>
      )}

      {/* 4. Global Dynamic Lightbox Modal */}
      {activeLightboxIndex !== null && (
        <Lightbox
          media={activeLightboxItem}
          mediaList={mediaItems}
          onSelectMedia={(item, index) => setActiveLightboxIndex(index)}
          onClose={() => setActiveLightboxIndex(null)}
          onPrev={activeLightboxIndex > 0 ? handlePrevLightbox : undefined}
          onNext={activeLightboxIndex < mediaItems.length - 1 ? handleNextLightbox : undefined}
          onUpdate={fetchMedia}
        />
      )}

      {/* 5. Mixed-Media Slideshow Modal */}
      {isPlayingSlideshow && (
        <Slideshow
          items={mediaItems.filter((item) => selectedIds.includes(item.id))}
          onClose={() => {
            setIsPlayingSlideshow(false);
            setSelectedIds([]);
            setIsSelectMode(false);
          }}
        />
      )}
    </div>
  );
}
