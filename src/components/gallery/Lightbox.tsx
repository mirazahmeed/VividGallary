"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import {
  X,
  Heart,
  MessageSquare,
  Share2,
  Download,
  Info,
  Calendar,
  Layers,
  Camera,
  Maximize,
  ChevronLeft,
  ChevronRight,
  Send,
  Link as LinkIcon,
  ShieldCheck
} from "lucide-react";

export interface MediaItem {
  id: string;
  filename: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  thumbnailUrl: string | null;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  resolution: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  tags: Array<{ tag: { name: string } }>;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: { id: string; name: string | null; avatarUrl: string | null };
  }>;
  likes: Array<{ id: string; userId: string }>;
}

interface LightboxProps {
  media: MediaItem | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onUpdate?: () => void;
}

export default function Lightbox({ media, onClose, onPrev, onNext, onUpdate }: LightboxProps) {
  const { user, addNotification } = useApp();
  const [showDetails, setShowDetails] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<MediaItem["comments"]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const [durationDays, setDurationDays] = useState(7);
  const [password, setPassword] = useState("");
  
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    if (media && user) {
      setIsLiked(media.likes.some((like) => like.userId === user.id));
      setLikesCount(media.likes.length);
      setComments(media.comments || []);
      setZoomScale(1);
      setShareUrl("");
      setShowShareDrawer(false);
    }
  }, [media, user]);

  if (!media) return null;

  const handleLikeToggle = async () => {
    // Standard mock API call for like updates, then immediately update client state
    setIsLiked(!isLiked);
    setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));
    addNotification("Success", isLiked ? "Removed like" : "Liked media item", "success");
    if (onUpdate) onUpdate();
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    // Simulate backend addition of comment, immediately append to list
    const newComment = {
      id: Math.random().toString(),
      content: commentText,
      createdAt: new Date().toISOString(),
      user: {
        id: user?.id || "guest",
        name: user?.name || "Host Profile",
        avatarUrl: user?.avatarUrl || null,
      },
    };

    setComments((prev) => [...prev, newComment]);
    setCommentText("");
    addNotification("Success", "Comment posted", "success");
    if (onUpdate) onUpdate();
  };

  const handleGenerateShare = async () => {
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MEDIA",
          mediaId: media.id,
          password: password || null,
          durationDays: durationDays,
          downloadPermission: true,
          viewOnly: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const base = window.location.origin;
        setShareUrl(`${base}/share/${data.share.token}`);
        addNotification("Share Link Generated", "Dynamic sharing link copied to dashboard clipboard", "success");
      }
    } catch {
      addNotification("Error", "Failed to generate share link", "error");
    }
  };

  const copyToClipboard = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      addNotification("Copied", "Share link copied to clipboard", "success");
    }
  };

  // Mock highly complete EXIF properties
  const mockExif = {
    camera: "Sony Alpha 7R V",
    lens: "FE 24-70mm F2.8 GM II",
    iso: "ISO 100",
    aperture: "f/4.0",
    focal: "35mm",
    speed: "1/250s",
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md flex z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Floating Controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 text-white text-xs font-bold px-3">
          {media.filename}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white cursor-pointer transition-all"
            title="Info details"
          >
            <Info size={16} />
          </button>
          <a
            href={media.url}
            download={media.filename}
            target="_blank"
            className="p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white cursor-pointer transition-all flex items-center justify-center"
            title="Download original"
          >
            <Download size={16} />
          </a>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white cursor-pointer transition-all"
            title="Close Lightbox"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main viewer (Image / Video player) */}
      <div className="flex-1 flex items-center justify-center relative p-8 select-none">
        {/* Navigation Arrow buttons */}
        {onPrev && (
          <button
            onClick={onPrev}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-3.5 rounded-2xl bg-black/35 hover:bg-black/65 border border-white/5 text-white cursor-pointer active:scale-95 transition-all z-10"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-3.5 rounded-2xl bg-black/35 hover:bg-black/65 border border-white/5 text-white cursor-pointer active:scale-95 transition-all z-10"
          >
            <ChevronRight size={22} />
          </button>
        )}

        {/* Media Content Node */}
        <div className="max-w-full max-h-full overflow-hidden flex items-center justify-center">
          {media.type === "IMAGE" ? (
            <img
              src={media.url}
              alt={media.filename}
              className="max-w-[85vw] max-h-[85vh] object-contain rounded-lg transition-transform duration-200 shadow-2xl"
              style={{ transform: `scale(${zoomScale})` }}
              onDoubleClick={() => setZoomScale((prev) => (prev === 1 ? 2.2 : 1))}
            />
          ) : (
            <video
              src={media.url}
              controls
              autoPlay
              className="max-w-[85vw] max-h-[85vh] rounded-lg shadow-2xl"
            />
          )}
        </div>
      </div>

      {/* Slide-out Sidebar Drawer (Comments, details, EXIF, Likes, Shares) */}
      {showDetails && (
        <aside className="w-96 border-l border-border glass h-full flex flex-col justify-between overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300 relative z-10 bg-card/45">
          {/* Top tabs */}
          <div className="p-5 border-b border-border flex items-center justify-between shrink-0 bg-muted/10">
            <span className="font-bold text-sm">Media Properties</span>
            <button
              onClick={() => setShowDetails(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Likes and Share quick buttons */}
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLikeToggle}
                  className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isLiked
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Heart size={15} fill={isLiked ? "currentColor" : "none"} />
                  {likesCount} Likes
                </button>
                
                <button
                  onClick={() => setShowShareDrawer(!showShareDrawer)}
                  className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl border border-border/60 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <Share2 size={15} /> Share
                </button>
              </div>
            </div>

            {/* Sharing Generator Sub-panel */}
            {showShareDrawer && (
              <div className="p-4 bg-muted/40 border border-border/60 rounded-2xl space-y-3.5 animate-in slide-in-from-top-3 duration-200">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                  <Share2 size={12} className="text-primary" /> Generate Share Link
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground block mb-1">EXPIRY (DAYS)</label>
                    <select
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full bg-secondary/80 border border-border text-foreground px-2 py-1.5 rounded-lg focus:outline-none"
                    >
                      <option value={1}>1 Day</option>
                      <option value={7}>7 Days</option>
                      <option value={30}>30 Days</option>
                      <option value={999}>Infinite</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground block mb-1">PASSWORD (OPTIONAL)</label>
                    <input
                      type="password"
                      placeholder="Unlock key"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-secondary/80 border border-border text-foreground px-2 py-1.5 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={handleGenerateShare}
                  className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Generate Public Link
                </button>

                {shareUrl && (
                  <div className="flex gap-1.5 mt-2 bg-secondary/80 border border-border/60 p-2 rounded-lg items-center text-xs">
                    <input
                      type="text"
                      readOnly
                      value={shareUrl}
                      className="bg-transparent flex-1 select-all focus:outline-none pr-1 truncate"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="p-1.5 rounded bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                    >
                      <LinkIcon size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* General Media Metadata details */}
            <div className="space-y-3.5">
              <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <Layers size={13} className="text-primary" /> Technical Details
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 border border-border/40 p-3.5 rounded-2xl">
                <div>
                  <span className="text-[9px] text-muted-foreground block">FILE TYPE</span>
                  <span className="font-bold text-foreground truncate block">{media.mimeType}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">DIMENSIONS</span>
                  <span className="font-bold text-foreground block">
                    {media.width && media.height ? `${media.width} x ${media.height}` : "HD (1080p)"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">FILE SIZE</span>
                  <span className="font-bold text-foreground block">{(media.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">UPLOAD DATE</span>
                  <span className="font-bold text-foreground flex items-center gap-1 truncate">
                    <Calendar size={11} /> {new Date(media.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Premium Camera EXIF Details Panel */}
            <div className="space-y-3.5">
              <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <Camera size={13} className="text-primary" /> EXIF Metadata Capture
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 border border-border/40 p-3.5 rounded-2xl">
                <div className="col-span-2">
                  <span className="text-[9px] text-muted-foreground block">CAMERA SYSTEM</span>
                  <span className="font-bold text-foreground block">{mockExif.camera}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[9px] text-muted-foreground block">OPTICAL LENS</span>
                  <span className="font-bold text-foreground block truncate">{mockExif.lens}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">EXPOSURE</span>
                  <span className="font-bold text-foreground block">{mockExif.speed}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">APERTURE</span>
                  <span className="font-bold text-foreground block">{mockExif.aperture}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">FOCAL LENGTH</span>
                  <span className="font-bold text-foreground block">{mockExif.focal}</span>
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground block">SENSITIVITY</span>
                  <span className="font-bold text-foreground block">{mockExif.iso}</span>
                </div>
              </div>
            </div>

            {/* Dynamic Tags Area */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase">Associated Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {media.tags.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No tags annotated yet</span>
                ) : (
                  media.tags.map((t) => (
                    <span
                      key={t.tag.name}
                      className="text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-lg"
                    >
                      #{t.tag.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Collaborative Comments Stream Area */}
          <div className="h-64 border-t border-border bg-muted/15 flex flex-col justify-between shrink-0">
            {/* Comments Feed header */}
            <div className="px-4 py-2 border-b border-border flex items-center gap-1.5 shrink-0">
              <MessageSquare size={13} className="text-primary" />
              <span className="text-[10px] font-extrabold uppercase text-foreground">
                Comments Feed ({comments.length})
              </span>
            </div>

            {/* Scroller list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
              {comments.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-[10px] font-semibold text-muted-foreground">
                  No collaborative comments yet
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-foreground">{c.user.name || "Media Visitor"}</span>
                      <span className="text-[9px] text-muted-foreground/60">
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-normal bg-secondary/30 p-2 rounded-xl border border-border/20">
                      {c.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Input field footer */}
            <form onSubmit={handleCommentSubmit} className="p-3 border-t border-border flex gap-2 bg-background shrink-0">
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-secondary border border-border text-[11px] px-3 py-2 rounded-xl focus:outline-none focus:border-primary/60 text-foreground"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-primary text-primary-foreground hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center transition-all"
              >
                <Send size={12} />
              </button>
            </form>
          </div>
        </aside>
      )}
    </div>
  );
}
