"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import CustomVideoPlayer from "@/components/gallery/CustomVideoPlayer";
import {
  Lock,
  Download,
  Image as PhotoIcon,
  Video as VideoIcon,
  PlaySquare,
  Globe,
  Key,
  FolderOpen,
  Layers,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  X
} from "lucide-react";

interface SharedAsset {
  type: string;
  expiresAt: string | null;
  downloadPermission: boolean;
  viewOnly: boolean;
  media: {
    id: string;
    filename: string;
    type: string;
    url: string;
    size: number;
    mimeType: string;
  } | null;
  album: {
    id: string;
    name: string;
    description: string | null;
    media: Array<{
      media: {
        id: string;
        filename: string;
        type: "IMAGE" | "VIDEO";
        url: string;
        size: number;
      };
    }>;
  } | null;
  playlist: {
    id: string;
    name: string;
    items: Array<{
      order: number;
      media: {
        id: string;
        filename: string;
        type: "IMAGE" | "VIDEO";
        url: string;
        size: number;
      };
    }>;
  } | null;
}

export default function ShareDetailPage() {
  const params = useParams();
  const token = params.token as string;

  // Asset States
  const [asset, setAsset] = useState<SharedAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Password states
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Playlist slideshow player states (within share landing!)
  const [isPlayingSlideshow, setIsPlayingSlideshow] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideshowPaused, setSlideshowPaused] = useState(false);
  const slideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Root references
  const media = asset?.media;
  const activeSlide = asset?.playlist?.items[currentSlideIndex]?.media;



  const handleDownloadMedia = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!media) return;
    const link = document.createElement("a");
    link.href = media.url;
    link.download = media.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    if (token) {
      loadSharedAsset();
    }
  }, [token]);

  // Playlist slideshow slideshow controller
  useEffect(() => {
    if (!isPlayingSlideshow || slideshowPaused || !asset || !asset.playlist || asset.playlist.items.length === 0) {
      clearSlideTimer();
      return;
    }

    const currentItem = asset.playlist.items[currentSlideIndex]?.media;
    if (!currentItem) return;

    if (currentItem.type === "VIDEO") {
      clearSlideTimer();
      return;
    }

    slideTimerRef.current = setTimeout(() => {
      handleNextSlide();
    }, 4000); // Default 4 second timing transitions for public guest slideshows

    return () => clearSlideTimer();
  }, [isPlayingSlideshow, slideshowPaused, currentSlideIndex, asset]);

  const clearSlideTimer = () => {
    if (slideTimerRef.current) {
      clearTimeout(slideTimerRef.current);
      slideTimerRef.current = null;
    }
  };

  const loadSharedAsset = async (pwdAttempt?: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/shares/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pwdAttempt || null }),
      });

      const data = await res.json();

      if (res.ok) {
        setAsset(data.share);
        setPasswordRequired(false);
      } else if (res.status === 401 && data.passwordRequired) {
        setPasswordRequired(true);
      } else {
        setError(data.error || "Failed to load shared asset.");
      }
    } catch {
      setError("Network connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setVerifyingPassword(true);
    await loadSharedAsset(password);
    setVerifyingPassword(false);
  };

  const handleNextSlide = () => {
    if (!asset || !asset.playlist) return;
    if (currentSlideIndex < asset.playlist.items.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      setCurrentSlideIndex(0);
    }
  };

  const handlePrevSlide = () => {
    if (!asset || !asset.playlist) return;
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    } else {
      setCurrentSlideIndex(asset.playlist.items.length - 1);
    }
  };

  // Full-screen load loaders
  if (loading && !verifyingPassword) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-xs text-muted-foreground font-bold tracking-wider animate-pulse">
          RETRIEVING SHARED MEDIA ASSETS...
        </p>
      </div>
    );
  }

  // 1. Password challenge landing card
  if (passwordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full filter blur-3xl" />
        <div className="w-full max-w-md glass rounded-3xl p-8 border border-border shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shadow-md mb-4">
              <Lock size={22} className="animate-pulse" />
            </div>
            <h1 className="text-xl font-black text-foreground">Password Protected</h1>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-[280px]">
              This media sharing portfolio is locked by the host. Enter the secret access password code to unlock.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Enter secure passcode"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-secondary/40 border border-border/80 focus:border-primary/60 text-foreground text-xs px-3 py-3.5 rounded-2xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all text-center font-bold"
              required
            />
            {error && (
              <p className="text-[10px] text-rose-500 font-bold text-center animate-shake">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={verifyingPassword}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-xs shadow-lg cursor-pointer hover:shadow-primary/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
            >
              {verifyingPassword ? <Loader2 className="animate-spin" size={16} /> : "Verify passcode"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Access Error landing card
  if (error || !asset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="w-full max-w-md glass rounded-3xl p-8 border border-border shadow-2xl relative z-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-base font-black text-foreground">Access Violation</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error || "This shareable token has either expired or been permanently deleted by the host owner."}
          </p>
        </div>
      </div>
    );
  }

  // 3. Shared MEDIA Content node
  if (asset.type === "MEDIA" && asset.media) {
    const media = asset.media;
    return (
      <div className="min-h-screen bg-black/95 flex flex-col justify-between p-6">
        <div className="flex justify-between items-center text-white pb-4 border-b border-white/10 shrink-0">
          <span className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-lg border border-white/5 truncate max-w-[220px]">
            {media.filename}
          </span>
          {asset.downloadPermission && (
            <button
              onClick={handleDownloadMedia}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2 rounded-xl shadow cursor-pointer transition-colors shrink-0"
            >
              <Download size={14} /> Download Original
            </button>
          )}
        </div>

        {/* Media Frame */}
        <div className="flex-1 flex items-center justify-center p-4">
          {media.type === "IMAGE" ? (
            <img
              src={media.url}
              alt={media.filename}
              className="max-w-[85vw] max-h-[75vh] object-contain rounded-lg shadow-2xl"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <CustomVideoPlayer
              src={media.url}
              filename={media.filename}
              downloadAllowed={asset.downloadPermission}
              className="max-w-[85vw] max-h-[75vh] shadow-2xl"
            />
          )}
        </div>

        <div className="text-center text-white/50 text-[10px] shrink-0 font-medium">
          Powered by VividGallery public sharing protocols • {(media.size / 1024 / 1024).toFixed(2)} MB
        </div>
      </div>
    );
  }

  // 4. Shared ALBUM Contents node
  if (asset.type === "ALBUM" && asset.album) {
    const album = asset.album;
    return (
      <div className="min-h-screen bg-background flex flex-col p-6 space-y-6">
        {/* Top Header details */}
        <div className="flex justify-between items-center border-b border-border pb-5 shrink-0 max-w-6xl w-full mx-auto">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
              <FolderOpen className="text-primary" size={24} /> {album.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {album.description || "Shared album directory."}
            </p>
          </div>
          <span className="text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full shrink-0">
            {album.media.length} items shared
          </span>
        </div>

        {/* Masonry gallery lists */}
        <div className="masonry-grid flex-1 pb-12 max-w-6xl w-full mx-auto">
          {album.media.map((joint, index) => {
            const item = joint.media;
            const heightClass = index % 3 === 0 ? "h-64" : index % 2 === 0 ? "h-80" : "h-72";

            return (
              <div
                key={item.id}
                className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-secondary/20 shadow-sm transition-all duration-300 hover:scale-[1.01] ${heightClass}`}
              >
                {item.type === "IMAGE" ? (
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                ) : (
                  <div className="w-full h-full relative">
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                      muted
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <VideoIcon size={24} className="text-white" />
                    </div>
                  </div>
                )}

                {/* Hover overlay filename details (Bottom side) */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between z-10">
                  <div className="truncate pr-4">
                    <p className="text-[10px] font-bold text-white truncate mb-0.5">{item.filename}</p>
                    <span className="text-[8px] text-white/50">{(item.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  {asset.downloadPermission && (
                    <a
                      href={item.url}
                      download={item.filename}
                      target="_blank"
                      className="p-2 rounded-lg bg-primary/80 hover:bg-primary text-white cursor-pointer transition-colors shadow shrink-0"
                    >
                      <Download size={12} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 5. Shared PLAYLIST Autoplay Slideshow node
  if (asset.type === "PLAYLIST" && asset.playlist) {
    const playlist = asset.playlist;
    const slides = playlist.items.map((i) => i.media);
    const activeSlide = slides[currentSlideIndex];

    if (!isPlayingSlideshow) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center shadow-lg border border-primary/20 animate-pulse">
            <PlaySquare size={36} />
          </div>
          <div className="space-y-1 max-w-md">
            <h1 className="text-2xl font-black text-foreground">{playlist.name}</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This mixed-media playlist presentation is ready. Click play below to launch the auto-advancing slideshow.
            </p>
          </div>
          <button
            onClick={() => {
              setCurrentSlideIndex(0);
              setSlideshowPaused(false);
              setIsPlayingSlideshow(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white font-bold text-xs px-6 py-3 rounded-2xl cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-98"
          >
            <Play size={15} fill="currentColor" /> Play Shared Slideshow
          </button>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-300">
        {/* Top Controls */}
        <div className="p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white relative z-10">
          <div className="text-left">
            <h2 className="text-sm font-black truncate max-w-[220px]">{playlist.name}</h2>
            <span className="text-[9px] text-white/50 uppercase font-extrabold tracking-widest mt-0.5 inline-block">
              Slide {currentSlideIndex + 1} of {slides.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSlideshowPaused(!slideshowPaused)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all"
            >
              {slideshowPaused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}
            </button>
            <button
              onClick={() => setIsPlayingSlideshow(false)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-500 cursor-pointer transition-all"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Slide frame */}
        <div className="flex-grow flex items-center justify-center p-8 relative">
          {activeSlide.type === "IMAGE" ? (
            <img
              src={activeSlide.url}
              alt={activeSlide.filename}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <CustomVideoPlayer
              src={activeSlide.url}
              autoPlay
              onEnded={handleNextSlide}
              filename={activeSlide.filename}
              downloadAllowed={asset.downloadPermission}
              className="max-w-full max-h-[80vh] shadow-2xl"
            />
          )}
        </div>

        {/* Bottom quick navigation arrows bar */}
        <div className="p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6 text-white relative z-10 animate-fade-in">
          <button
            onClick={handlePrevSlide}
            className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl active:scale-95 transition-all cursor-pointer"
          >
            Previous
          </button>
          <span className="text-[11px] font-black text-white/80 select-none">
            {activeSlide.filename}
          </span>
          <button
            onClick={handleNextSlide}
            className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl active:scale-95 transition-all cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  return null;
}
