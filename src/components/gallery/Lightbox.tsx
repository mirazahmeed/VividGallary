"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useApp } from "@/context/AppContext";
import UserAvatar from "../layout/UserAvatar";

const CustomVideoPlayer = dynamic(() => import("./CustomVideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="max-w-[95vw] sm:max-w-[85vw] max-h-[58vh] sm:max-h-[68vh] flex items-center justify-center bg-black/40 rounded-lg">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  ),
});

const ImageEditor = dynamic(() => import("./ImageEditor"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center z-[60]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  ),
});
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
  ShieldCheck,
  Loader2,
  Sparkles,
  Search
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
  metadata: string | null;
  createdAt: string;
  tags: Array<{ tag: { name: string } }>;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: { id: string; name: string | null; avatarUrl: string | null };
  }>;
  likes: Array<{ id: string; userId: string }>;
  visibility?: "PUBLIC" | "PRIVATE";
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    isFollowing?: boolean;
  };
}

function getRelatedMediaItems(items: MediaItem[], current: MediaItem, excludedIds = new Set<string>()) {
  const currentTagNames = new Set(current.tags?.map((tag) => tag.tag.name) || []);

  return items
    .filter((item) => item.id !== current.id && !excludedIds.has(item.id))
    .map((item) => {
      const itemTags = item.tags?.map((tag) => tag.tag.name) || [];
      const matchingTags = itemTags.filter((tag) => currentTagNames.has(tag));
      let score = 0;

      if (item.type === current.type) score += 6;
      if (item.user?.id === current.user?.id) score += 3;
      score += matchingTags.length * 8;
      score += (item.likes?.length || 0) * 0.1;
      score += (item.comments?.length || 0) * 0.15;

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime();
    })
    .slice(0, 12)
    .map(({ item }) => item);
}

interface LightboxProps {
  media: MediaItem | null;
  mediaList?: MediaItem[];
  onSelectMedia?: (media: MediaItem, index: number) => void;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onUpdate?: () => void;
  hideSuggestions?: boolean;
}

export default function Lightbox({
  media,
  mediaList,
  onSelectMedia,
  onClose,
  onPrev,
  onNext,
  onUpdate,
  hideSuggestions = false,
}: LightboxProps) {
  const { user, addNotification } = useApp();
  const [showDetails, setShowDetails] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState<MediaItem["comments"]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const [durationDays, setDurationDays] = useState(7);
  const [password, setPassword] = useState("");

  // Share in Chat states
  const [showShareInChatDrawer, setShowShareInChatDrawer] = useState(false);
  const [chatContacts, setChatContacts] = useState<any[]>([]);
  const [searchResultsContacts, setSearchResultsContacts] = useState<any[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [sharingToUserId, setSharingToUserId] = useState<string | null>(null);
  const [shareInChatSearch, setShareInChatSearch] = useState("");

  // Load active conversation contacts
  useEffect(() => {
    if (showShareInChatDrawer) {
      loadChatContacts();
    } else {
      setShareInChatSearch("");
      setSearchResultsContacts([]);
    }
  }, [showShareInChatDrawer]);

  const loadChatContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await fetch("/api/chat/conversations");
      if (res.ok) {
        const data = await res.json();
        const contacts = (data.conversations || []).map((c: any) => c.user);
        setChatContacts(contacts);
      }
    } catch {
      console.error("Failed to load contacts for share");
    } finally {
      setContactsLoading(false);
    }
  };

  const handleSearchContacts = async (query: string) => {
    if (!query.trim()) {
      setSearchResultsContacts([]);
      return;
    }
    setContactsLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResultsContacts(data.users || []);
      }
    } catch {
      console.error("Failed to search contacts");
    } finally {
      setContactsLoading(false);
    }
  };

  const handleShareMediaToUser = async (targetUserId: string) => {
    if (!media) return;
    setSharingToUserId(targetUserId);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: targetUserId,
          mediaId: media.id
        })
      });
      if (res.ok) {
        addNotification("Shared", "Media shared in chat successfully", "success");
        setShowShareInChatDrawer(false);
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to share media", "error");
      }
    } catch {
      addNotification("Error", "Network request failed", "error");
    } finally {
      setSharingToUserId(null);
    }
  };

  const displayContacts = shareInChatSearch ? searchResultsContacts : chatContacts;
  
  const [zoomScale, setZoomScale] = useState(1);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [universeMediaItems, setUniverseMediaItems] = useState<MediaItem[]>([]);
  const [universeLoading, setUniverseLoading] = useState(false);

  // Touch swipe state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  // Rename states
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);

  // Tag editor state
  const [newTag, setNewTag] = useState("");

  // Image editor modal visibility
  const [showImageEditor, setShowImageEditor] = useState(false);

  // Reset states when media changes
  useEffect(() => {
    if (media) {
      setTempName(media.filename);
      setIsEditingName(false);
      setNewTag("");
      setShowImageEditor(false);
    }
  }, [media]);

  const activeThumbnailRef = useRef<HTMLButtonElement | null>(null);

  // Scroll active thumbnail in strip into view when active media changes
  const currentIndex = mediaList && media ? mediaList.findIndex((item) => item.id === media.id) : -1;

  const relatedItems = React.useMemo(() => {
    if (!media || !mediaList || mediaList.length <= 1) return [];
    return getRelatedMediaItems(mediaList, media);
  }, [media, mediaList]);

  const universeRelatedItems = React.useMemo(() => {
    if (!media || universeMediaItems.length <= 1) return [];
    const excludedIds = new Set([media.id, ...relatedItems.map((item) => item.id)]);
    return getRelatedMediaItems(universeMediaItems, media, excludedIds);
  }, [media, universeMediaItems, relatedItems]);

  useEffect(() => {
    if (!media?.id || !user || hideSuggestions) return;

    let cancelled = false;
    // Defer universe media fetch by 2s to prioritize main content rendering
    const timeoutId = setTimeout(async () => {
      setUniverseLoading(true);
      try {
        const res = await fetch("/api/media");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setUniverseMediaItems(data.media || []);
        }
      } catch {
      } finally {
        if (!cancelled) setUniverseLoading(false);
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [media?.id, user, hideSuggestions]);

  useEffect(() => {
    if (activeThumbnailRef.current) {
      activeThumbnailRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [media]);

  const handleRenameSave = async () => {
    if (!tempName.trim() || !media) return;
    setIsSavingName(true);
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: tempName.trim() }),
      });
      if (res.ok) {
        addNotification("Success", "Filename updated successfully", "success");
        setIsEditingName(false);
        if (onUpdate) onUpdate();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Rename failed");
      }
    } catch (err: any) {
      addNotification("Error", err.message || "Failed to update filename", "error");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim() || !media) return;
    const clean = newTag.trim().toLowerCase();
    const currentTags = media.tags?.map((t) => t.tag.name) || [];
    if (currentTags.includes(clean)) {
      setNewTag("");
      return;
    }
    const updatedTags = [...currentTags, clean];
    setNewTag("");
    await saveTagsChange(updatedTags);
  };

  const handleRemoveTag = async (tagName: string) => {
    if (!media) return;
    const currentTags = media.tags?.map((t) => t.tag.name) || [];
    const updatedTags = currentTags.filter((name) => name !== tagName);
    await saveTagsChange(updatedTags);
  };

  const saveTagsChange = async (updatedTags: string[]) => {
    if (!media) return;
    try {
      const res = await fetch(`/api/media/${media.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (res.ok) {
        addNotification("Success", "Tags updated successfully", "success");
        if (onUpdate) onUpdate();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Update tags failed");
      }
    } catch (err: any) {
      addNotification("Error", err.message || "Failed to update tags", "error");
    }
  };

  useEffect(() => {
    if (media && user) {
      setIsLiked(media.likes?.some((like) => like.userId === user.id) || false);
      setLikesCount(media.likes?.length || 0);
      setComments(media.comments || []);
      setZoomScale(1);
      setShareUrl("");
      setShowShareDrawer(false);
      setShowShareInChatDrawer(false);
      setShareInChatSearch("");
      setIsFollowingUser(!!media.user?.isFollowing);
      setSwipeOffset(0);
    }
  }, [media, user]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  // Touch swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (zoomScale !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setIsSwiping(false);
  }, [zoomScale]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || zoomScale !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    // Only horizontal swipe (not vertical scroll)
    if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > deltaY) {
      setIsSwiping(true);
      setSwipeOffset(deltaX);
    }
  }, [zoomScale]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;
    const threshold = 60;
    const elapsed = Date.now() - touchStartRef.current.time;
    // Fast flick or long drag
    if (isSwiping) {
      if (swipeOffset < -threshold && onNext) {
        onNext();
      } else if (swipeOffset > threshold && onPrev) {
        onPrev();
      }
    }
    touchStartRef.current = null;
    setSwipeOffset(0);
    setIsSwiping(false);
  }, [isSwiping, swipeOffset, onNext, onPrev]);

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!media) return;
    const link = document.createElement("a");
    link.href = media.url;
    link.download = media.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!media) return null;

  const handleFollowToggle = async () => {
    if (!media.user || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await fetch("/api/follow", {
        method: isFollowingUser ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: media.user.id }),
      });
      if (res.ok) {
        setIsFollowingUser(!isFollowingUser);
        addNotification(
          "Success",
          isFollowingUser
            ? `Unfollowed ${media.user.name || media.user.email}`
            : `Followed ${media.user.name || media.user.email}`,
          "success"
        );
        if (onUpdate) onUpdate();
      } else {
        const errData = await res.json();
        addNotification("Error", errData.error || "Failed to update follow status", "error");
      }
    } catch (err) {
      addNotification("Error", "Failed to update follow status", "error");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLikeToggle = async () => {
    setIsLiked(!isLiked);
    setLikesCount((prev) => (isLiked ? prev - 1 : prev + 1));
    addNotification("Success", isLiked ? "Removed like" : "Liked media item", "success");
    if (onUpdate) onUpdate();
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

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

  // Parse actual EXIF from database
  const parsedMetadata = (() => {
    try {
      if (media.metadata) {
        return JSON.parse(media.metadata);
      }
    } catch (e) {
      console.error("Failed to parse metadata JSON:", e);
    }
    return null;
  })();

  const exif = {
    camera: parsedMetadata?.camera || "N/A",
    lens: parsedMetadata?.lens || "N/A",
    speed: parsedMetadata?.shutterSpeed || "N/A",
    aperture: parsedMetadata?.aperture || "N/A",
    focal: parsedMetadata?.focalLength || "N/A",
    iso: parsedMetadata?.iso ? `ISO ${parsedMetadata.iso}` : "N/A",
  };

  const renderRelatedSection = (items: MediaItem[], loading: boolean, title: string, subtitle: string) => {
    if (loading) {
      return (
        <section className="w-full max-w-6xl px-2 sm:px-4 mt-10 mb-8">
          <div className="flex items-center gap-2 text-white/95 mb-4">
            <Sparkles size={14} className="text-primary" />
            <h3 className="text-sm sm:text-base font-black">{title}</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="glass border border-white/10 rounded-2xl overflow-hidden p-3">
                <div className="aspect-[4/3] rounded-xl bg-white/10 animate-pulse" />
                <div className="h-3 rounded bg-white/10 mt-3 animate-pulse" />
                <div className="h-3 rounded bg-white/10 mt-2 w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (items.length === 0) return null;

    return (
      <section className="w-full max-w-6xl px-2 sm:px-4 mt-10 mb-8">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-white/95">
              <Sparkles size={14} className="text-primary" />
              <h3 className="text-sm sm:text-base font-black">{title}</h3>
            </div>
            <p className="text-[10px] text-white/50 mt-1">{subtitle}</p>
          </div>
          <span className="text-[10px] font-bold text-white/50 bg-white/10 border border-white/10 px-2 py-1 rounded-full shrink-0">
            {items.length} picks
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {items.map((item) => {
            const relatedIndex = mediaList?.findIndex((listItem) => listItem.id === item.id) ?? -1;

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (onSelectMedia && relatedIndex !== -1) {
                    onSelectMedia(item, relatedIndex);
                    return;
                  }

                  if (relatedIndex < currentIndex && onPrev) {
                    const diff = currentIndex - relatedIndex;
                    for (let i = 0; i < diff; i++) onPrev();
                  } else if (relatedIndex > currentIndex && onNext) {
                    const diff = relatedIndex - currentIndex;
                    for (let i = 0; i < diff; i++) onNext();
                  }
                }}
                className="group text-left glass border border-white/10 rounded-2xl overflow-hidden shadow-lg hover:border-primary/40 hover:scale-[1.01] transition-all active:scale-98"
              >
                <div className="relative aspect-[4/3] bg-secondary overflow-hidden">
                  {item.type === "IMAGE" ? (
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full relative bg-neutral-900 group-hover:scale-105 transition-transform duration-500">
                      <video
                        src={`${item.url}#t=0.1`}
                        className="w-full h-full object-cover opacity-75"
                        muted
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-white bg-black/10">
                        <span className="text-[8px] font-black bg-black/75 px-1.5 py-0.5 rounded tracking-tight">VIDEO</span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-bold text-white truncate">{item.filename}</p>
                  <span className="text-[9px] text-white/50 block mt-0.5">{item.type}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  // Details sidebar content (shared between desktop sidebar and mobile bottom sheet)
  const detailsContent = (
    <>
      {/* Filename & Editing */}
      <div className="space-y-1 bg-muted/20 border border-border/40 p-3.5 rounded-2xl">
        <span className="text-[9px] text-muted-foreground block uppercase font-bold">FILENAME</span>
        {isEditingName ? (
          <div className="flex gap-1.5 items-center">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="flex-1 bg-secondary border border-border text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary text-foreground min-w-0"
            />
            <button
              onClick={handleRenameSave}
              disabled={isSavingName}
              className="px-2.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50 shrink-0"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsEditingName(false);
                setTempName(media.filename);
              }}
              className="px-2.5 py-1.5 bg-secondary border border-border text-muted-foreground text-xs font-bold rounded-lg cursor-pointer shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="font-bold text-foreground truncate block max-w-[200px]" title={media.filename}>{media.filename}</span>
            {user && (!media.user || media.user.id === user.id) && (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-[10px] text-primary hover:text-primary/80 font-bold uppercase cursor-pointer"
              >
                Rename
              </button>
            )}
          </div>
        )}
      </div>

      {/* Canvas Image Editor Button */}
      {media.type === "IMAGE" && user && (!media.user || media.user.id === user.id) && (
        <button
          onClick={() => setShowImageEditor(true)}
          className="w-full py-2 bg-primary/10 hover:bg-primary/15 border border-primary/20 hover:border-primary/45 text-primary text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
        >
          <Sparkles size={13} className="text-primary" /> Edit Photo copy (Canvas)
        </button>
      )}

      {/* Uploader Profile & Follow Button */}
      {media.user && (
        <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border/40 rounded-2xl">
          <div className="flex items-center gap-3">
            <UserAvatar
              avatarUrl={media.user.avatarUrl}
              name={media.user.name}
              email={media.user.email}
              className="w-10 h-10 rounded-full font-bold text-sm shadow"
            />
            <div>
              <p className="text-xs font-bold text-foreground leading-tight">{media.user.name || "Anonymous User"}</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{media.user.email}</p>
            </div>
          </div>
          {user && media.user.id !== user.id && (
            <button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                isFollowingUser
                  ? "bg-secondary text-foreground hover:bg-secondary/80 border-border"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
              }`}
            >
              {followLoading ? "..." : isFollowingUser ? "Following" : "Follow"}
            </button>
          )}
        </div>
      )}

      {/* Likes and Share quick buttons */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLikeToggle}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isLiked
                ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart size={15} fill={isLiked ? "currentColor" : "none"} />
            {likesCount} Likes
          </button>
          
          <button
            onClick={() => {
              setShowShareDrawer(!showShareDrawer);
              setShowShareInChatDrawer(false);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 text-xs font-bold cursor-pointer transition-colors ${
              showShareDrawer
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Share2 size={15} /> Share
          </button>

          {user && (
            <button
              onClick={() => {
                setShowShareInChatDrawer(!showShareInChatDrawer);
                setShowShareDrawer(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/60 text-xs font-bold cursor-pointer transition-colors ${
                showShareInChatDrawer
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare size={15} /> Share in Chat
            </button>
          )}
        </div>
      </div>

      {/* Share in Chat Drawer */}
      {showShareInChatDrawer && (
        <div className="p-4 bg-muted/40 border border-border/60 rounded-2xl space-y-3 animate-in slide-in-from-top-3 duration-200">
          <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-foreground flex items-center gap-1.5">
            <MessageSquare size={12} className="text-primary" /> Share in Direct Chat
          </h4>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search user to share with..."
              value={shareInChatSearch}
              onChange={(e) => {
                setShareInChatSearch(e.target.value);
                handleSearchContacts(e.target.value);
              }}
              className="w-full bg-secondary/80 border border-border text-xs pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-primary/60 text-foreground"
            />
            <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={12} />
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {contactsLoading ? (
              <div className="py-4 text-center text-xs font-semibold text-muted-foreground flex justify-center items-center gap-1.5">
                <Loader2 className="animate-spin text-primary" size={12} /> Loading...
              </div>
            ) : displayContacts.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground font-semibold">
                No users found. Try searching.
              </div>
            ) : (
              displayContacts.map((contact: any) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <UserAvatar
                      avatarUrl={contact.avatarUrl}
                      name={contact.name}
                      email={contact.email}
                      className="w-6 h-6 rounded-full font-bold text-[8px]"
                    />
                    <div className="truncate text-left">
                      <p className="text-[10.5px] font-bold text-foreground truncate">{contact.name || "Media Owner"}</p>
                      <p className="text-[8.5px] text-muted-foreground truncate">{contact.email}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleShareMediaToUser(contact.id)}
                    disabled={sharingToUserId === contact.id}
                    className="px-2.5 py-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-lg cursor-pointer hover:bg-primary/95 transition-all flex items-center gap-1 disabled:opacity-50 shrink-0"
                  >
                    {sharingToUserId === contact.id ? (
                      <Loader2 size={9} className="animate-spin" />
                    ) : (
                      "Share"
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
            <span className="font-bold text-foreground block">{exif.camera}</span>
          </div>
          <div className="col-span-2">
            <span className="text-[9px] text-muted-foreground block">OPTICAL LENS</span>
            <span className="font-bold text-foreground block truncate">{exif.lens}</span>
          </div>
          <div>
            <span className="text-[9px] text-muted-foreground block">EXPOSURE</span>
            <span className="font-bold text-foreground block">{exif.speed}</span>
          </div>
          <div>
            <span className="text-[9px] text-muted-foreground block">APERTURE</span>
            <span className="font-bold text-foreground block">{exif.aperture}</span>
          </div>
          <div>
            <span className="text-[9px] text-muted-foreground block">FOCAL LENGTH</span>
            <span className="font-bold text-foreground block">{exif.focal}</span>
          </div>
          <div>
            <span className="text-[9px] text-muted-foreground block">SENSITIVITY</span>
            <span className="font-bold text-foreground block">{exif.iso}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Tags Area */}
      <div className="space-y-3.5 bg-muted/20 border border-border/40 p-3.5 rounded-2xl">
        <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase block">Associated Tags</span>
        <div className="flex flex-wrap gap-1.5">
          {!media.tags || media.tags.length === 0 ? (
            <span className="text-xs text-muted-foreground">No tags annotated yet</span>
          ) : (
            media.tags.map((t) => (
              <span
                key={t.tag.name}
                className="text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-lg flex items-center gap-1"
              >
                #{t.tag.name}
                {user && (!media.user || media.user.id === user.id) && (
                  <button
                    onClick={() => handleRemoveTag(t.tag.name)}
                    className="hover:text-rose-500 transition-colors ml-1 font-bold text-[8px] cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )}
        </div>

        {user && (!media.user || media.user.id === user.id) && (
          <div className="flex gap-1.5 mt-2">
            <input
              type="text"
              placeholder="Add tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="flex-1 bg-secondary/80 border border-border text-[10px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary/60 text-foreground"
            />
            <button
              onClick={handleAddTag}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-lg hover:bg-primary/95 transition-colors cursor-pointer"
            >
              Add
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md flex flex-col md:flex-row z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Main viewer (Image / Video player) with touch swipe */}
      <div
        className="flex-1 min-h-0 overflow-y-auto scroll-smooth select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Header Floating Controls */}
        <div className="sticky top-3 left-0 right-0 z-20 px-3 sm:px-4">
          <div className="flex items-center justify-between bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10 text-white text-[10px] sm:text-xs font-bold">
            <div className="truncate max-w-[45vw] sm:max-w-none pr-2">
              {media.filename}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className={`p-2 sm:p-2.5 rounded-xl border border-white/10 text-white cursor-pointer transition-all ${
                  showDetails ? "bg-primary/60" : "bg-black/40 hover:bg-black/60"
                }`}
                title="Info details"
              >
                <Info size={16} />
              </button>
              {user && (!media.user || media.user.id === user.id) && (
                <button
                  onClick={handleDownload}
                  className="p-2 sm:p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white cursor-pointer transition-all flex items-center justify-center"
                  title="Download original"
                >
                  <Download size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 sm:p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-white cursor-pointer transition-all"
                title="Close Lightbox"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col items-center p-4 pt-8 sm:p-8 sm:pt-10 min-h-0">
          {/* Navigation Arrow buttons — hidden on mobile (use swipe instead) */}
          {onPrev && (
            <button
              onClick={onPrev}
              className="absolute left-2 sm:left-6 top-44 sm:top-52 p-3 sm:p-3.5 rounded-2xl bg-black/35 hover:bg-black/65 border border-white/5 text-white cursor-pointer active:scale-95 transition-all z-10 hidden sm:flex"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="absolute right-2 sm:right-6 top-44 sm:top-52 p-3 sm:p-3.5 rounded-2xl bg-black/35 hover:bg-black/65 border border-white/5 text-white cursor-pointer active:scale-95 transition-all z-10 hidden sm:flex"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Media Content Node — with swipe transform */}
          <div
            className="w-full flex items-center justify-center shrink-0 min-h-[300px] will-change-transform"
            style={{
              transform: isSwiping ? `translateX(${swipeOffset}px)` : "translateX(0)",
              transition: isSwiping ? "none" : "transform 0.25s ease-out",
            }}
          >
            {media.type === "IMAGE" ? (
              <img
                src={media.url}
                alt={media.filename}
                className="max-w-[95vw] sm:max-w-[85vw] max-h-[58vh] sm:max-h-[68vh] object-contain rounded-lg transition-transform duration-200 shadow-2xl"
                style={{ transform: `scale(${zoomScale})` }}
                onDoubleClick={() => setZoomScale((prev) => (prev === 1 ? 2.2 : 1))}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
            ) : (
              <CustomVideoPlayer
                src={media.url}
                autoPlay
                filename={media.filename}
                className="max-w-[95vw] sm:max-w-[85vw] max-h-[58vh] sm:max-h-[68vh] shadow-2xl"
                downloadAllowed={false}
                onNext={onNext}
                onPrev={onPrev}
              />
            )}
          </div>

          {/* Horizontal thumbnail strip at the bottom of the main viewer */}
          {mediaList && currentIndex !== -1 && (
            <div className="w-full max-w-xl mx-auto mt-4 px-2 pb-1 shrink-0 z-20">
              <div className="bg-black/35 backdrop-blur-md border border-white/5 rounded-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none justify-start sm:justify-center select-none">
                {mediaList.map((item, idx) => {
                  const isActive = idx === currentIndex;
                  return (
                    <button
                      key={item.id}
                      ref={isActive ? activeThumbnailRef : undefined}
                      onClick={() => {
                        if (onSelectMedia) {
                          onSelectMedia(item, idx);
                        } else if (idx < currentIndex && onPrev) {
                          const diff = currentIndex - idx;
                          for (let i = 0; i < diff; i++) onPrev();
                        } else if (idx > currentIndex && onNext) {
                          const diff = idx - currentIndex;
                          for (let i = 0; i < diff; i++) onNext();
                        }
                      }}
                      className={`relative w-11 h-11 rounded-xl overflow-hidden border-2 cursor-pointer transition-all shrink-0 hover:scale-105 active:scale-95 ${
                        isActive
                          ? "border-primary ring-2 ring-primary/20 scale-105"
                          : "border-transparent opacity-50 hover:opacity-90"
                      }`}
                    >
                      {item.type === "IMAGE" ? (
                        <img
                          src={item.thumbnailUrl || item.url}
                          alt={item.filename}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full relative bg-neutral-900">
                          <video
                            src={`${item.url}#t=0.1`}
                            className="w-full h-full object-cover opacity-70"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-white/95 bg-black/10">
                            <span className="text-[6px] font-black bg-black/75 px-1 py-0.5 rounded tracking-tight">VID</span>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!hideSuggestions && renderRelatedSection(
            relatedItems,
            false,
            "You May Also Like",
            "Related picks based on matching media type, tags, and creator."
          )}
          {!hideSuggestions && renderRelatedSection(
            universeRelatedItems,
            universeLoading,
            "You May Also Like From Universe",
            "Suggestions from your full media universe across every album."
          )}

          {/* Mobile swipe hint indicators */}
          {!mediaList && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-4 sm:hidden pointer-events-none">
              {onPrev && (
                <span className="text-[9px] text-white/40 font-bold flex items-center gap-1">
                  <ChevronLeft size={12} /> Swipe
                </span>
              )}
              {onNext && (
                <span className="text-[9px] text-white/40 font-bold flex items-center gap-1">
                  Swipe <ChevronRight size={12} />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: Slide-out Sidebar Drawer */}
      {showDetails && (
        <aside className="hidden md:flex w-96 border-l border-border glass h-full flex-col justify-between overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300 relative z-10 bg-card/45">
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
            {detailsContent}
          </div>

          {/* Collaborative Comments Stream Area */}
          <div className="h-64 border-t border-border bg-muted/15 flex flex-col justify-between shrink-0">
            <div className="px-4 py-2 border-b border-border flex items-center gap-1.5 shrink-0">
              <MessageSquare size={13} className="text-primary" />
              <span className="text-[10px] font-extrabold uppercase text-foreground">
                Comments Feed ({comments.length})
              </span>
            </div>
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

      {/* Mobile: Bottom sheet details drawer */}
      {showDetails && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setShowDetails(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[70vh] bg-card border-t border-border rounded-t-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-4 pb-2 flex items-center justify-between shrink-0">
              <span className="font-bold text-sm text-foreground">Media Properties</span>
              <button
                onClick={() => setShowDetails(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
              {detailsContent}

              {/* Comments section inline on mobile */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-primary" />
                  <span className="text-[10px] font-extrabold uppercase text-foreground">
                    Comments ({comments.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <div className="py-4 text-center text-[10px] font-semibold text-muted-foreground">
                      No comments yet
                    </div>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-foreground">{c.user.name || "Visitor"}</span>
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
                <form onSubmit={handleCommentSubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 bg-secondary border border-border text-[11px] px-3 py-2.5 rounded-xl focus:outline-none focus:border-primary/60 text-foreground"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-primary text-primary-foreground cursor-pointer flex items-center justify-center"
                  >
                    <Send size={12} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual Canvas Image Editor Modal */}
      {showImageEditor && media.type === "IMAGE" && (
        <ImageEditor
          media={media}
          onClose={() => setShowImageEditor(false)}
          onSaveSuccess={(newMedia) => {
            if (onUpdate) onUpdate();
          }}
        />
      )}
    </div>
  );
}
