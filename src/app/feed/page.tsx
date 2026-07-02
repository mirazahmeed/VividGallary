"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import FeedVideoPlayer from "@/components/gallery/FeedVideoPlayer";
import NextImage from "next/image";
import UserAvatar from "@/components/layout/UserAvatar";
const MediaCollage = dynamic(() => import("@/components/gallery/MediaCollage"), {
  ssr: false,
  loading: () => (
    <div className="py-8 flex justify-center">
      <Loader2 className="animate-spin text-primary" size={20} />
    </div>
  ),
});
import type { MediaItem } from "@/components/gallery/Lightbox";
import {
  Newspaper,
  Search,
  Loader2,
  Heart,
  MessageSquare,
  Clock,
  Plus,
  X,
  Image as ImageIcon,
  Globe,
  Lock,
  Compass,
  UserPlus,
  UserCheck,
  UserX,
  Send,
  SlidersHorizontal,
  Flame
} from "lucide-react";

const Lightbox = dynamic(() => import("@/components/gallery/Lightbox"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center z-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  ),
});

interface FeedItem {
  id: string;
  feedType: "POST" | "ALBUM" | "MEDIA";
  content: string | null;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
    username: string | null;
    isFollowing?: boolean;
  };
  media?: any | null;
  albumDetails?: {
    name: string;
    isDefault: boolean;
    visibility: string;
  };
  albumMedia?: any[] | null;
  likes: any[];
  comments: any[];
}

export default function FeedPage() {
  const { user, addNotification } = useApp();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [activeFilter, setActiveFilter] = useState<"all" | "following">("all");
  const [activeType, setActiveType] = useState<"all" | "posts" | "photos" | "videos" | "albums">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  // Composer
  const [postContent, setPostContent] = useState("");
  const [attachedMedia, setAttachedMedia] = useState<any | null>(null);
  const [composing, setComposing] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [galleryMedia, setGalleryMedia] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Lightbox
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [activeLightboxMediaList, setActiveLightboxMediaList] = useState<MediaItem[]>([]);

  // Expanded comments section states per item
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  // Follow states
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load feed items when dependencies change
  useEffect(() => {
    if (user) {
      setPage(1);
      fetchFeed(1, true);
    }
  }, [user, activeFilter, activeType, debouncedSearchQuery]);

  const fetchFeed = async (pageNum: number, isInitial = false) => {
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      let url = `/api/feed?page=${pageNum}&limit=10&filter=${activeFilter}&type=${activeType}`;
      if (debouncedSearchQuery) {
        url += `&search=${encodeURIComponent(debouncedSearchQuery)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (isInitial) {
          setFeedItems(data.posts || []);
        } else {
          setFeedItems(prev => [...prev, ...(data.posts || [])]);
        }
        setHasMore(data.hasMore || false);
      } else {
        addNotification("Error", "Failed to retrieve social feed", "error");
      }
    } catch {
      addNotification("Error", "Failed to retrieve social feed", "error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeed(nextPage, false);
  };

  // Composer Media Picker handlers
  const openGalleryPicker = async () => {
    setIsMediaPickerOpen(true);
    setGalleryLoading(true);
    try {
      const res = await fetch("/api/media");
      if (res.ok) {
        const data = await res.json();
        setGalleryMedia(data.media || []);
      }
    } catch {
      addNotification("Error", "Failed to load gallery assets", "error");
    } finally {
      setGalleryLoading(false);
    }
  };

  // Composer submit handler
  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() && !attachedMedia) return;

    setComposing(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: postContent,
          mediaId: attachedMedia?.id || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Map the newly created post structure to fit our feed item format
        const newFeedItem: FeedItem = {
          id: data.post.id,
          feedType: "POST",
          content: data.post.content,
          createdAt: data.post.createdAt,
          userId: data.post.userId,
          user: {
            id: data.post.user.id,
            name: data.post.user.name,
            email: data.post.user.email,
            avatarUrl: data.post.user.avatarUrl,
            username: data.post.user.username,
            isFollowing: false
          },
          media: data.post.media,
          likes: data.post.likes || [],
          comments: data.post.comments || []
        };

        setFeedItems(prev => [newFeedItem, ...prev]);
        setPostContent("");
        setAttachedMedia(null);
        addNotification("Success", "Post shared to timeline feed", "success");
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to publish post", "error");
      }
    } catch {
      addNotification("Error", "Connection error", "error");
    } finally {
      setComposing(false);
    }
  };

  // Follow/Unfollow handler
  const handleFollowToggle = async (targetUserId: string, isFollowing: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (followLoadingId) return;
    setFollowLoadingId(targetUserId);

    try {
      const res = await fetch("/api/follow", {
        method: isFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });

      if (res.ok) {
        // Toggle the isFollowing flag for all items by this user in feed
        setFeedItems(prev =>
          prev.map(item => {
            if (item.user && item.user.id === targetUserId) {
              return {
                ...item,
                user: {
                  ...item.user,
                  isFollowing: !isFollowing,
                },
              };
            }
            return item;
          })
        );

        addNotification(
          "Success",
          isFollowing ? "Unfollowed user successfully" : "Followed user successfully",
          "success"
        );
      } else {
        const errData = await res.json();
        addNotification("Error", errData.error || "Failed to update follow status", "error");
      }
    } catch {
      addNotification("Error", "Failed to update follow status", "error");
    } finally {
      setFollowLoadingId(null);
    }
  };

  // Likes handlers
  const handleToggleLike = async (item: FeedItem) => {
    if (!user) return;
    const isPost = item.feedType === "POST";
    const isMedia = item.feedType === "MEDIA";
    if (!isPost && !isMedia) return; // Albums liked through lightbox items

    const userLiked = item.likes.some(l => l.userId === user.id);
    const likeEndpoint = isPost ? `/api/posts/${item.id}/like` : `/api/media/${item.id}/like`;

    // Optimistically update the UI state
    setFeedItems(prev =>
      prev.map(f => {
        if (f.id === item.id) {
          const updatedLikes = userLiked
            ? f.likes.filter(l => l.userId !== user.id)
            : [...f.likes, { id: Math.random().toString(), userId: user.id }];
          return { ...f, likes: updatedLikes };
        }
        return f;
      })
    );

    try {
      const res = await fetch(likeEndpoint, { method: "POST" });
      if (!res.ok) {
        // Rollback state if query fails
        fetchFeed(1, true);
        addNotification("Error", "Failed to sync like action", "error");
      }
    } catch {
      fetchFeed(1, true);
      addNotification("Error", "Connection error during like action", "error");
    }
  };

  // Comment submit handler
  const handleCommentSubmit = async (item: FeedItem, e: React.FormEvent) => {
    e.preventDefault();
    const text = commentInputs[item.id] || "";
    if (!text.trim() || submittingComment[item.id]) return;

    setSubmittingComment(prev => ({ ...prev, [item.id]: true }));

    const isPost = item.feedType === "POST";
    const commentEndpoint = isPost ? `/api/posts/${item.id}/comment` : `/api/media/${item.id}/comment`;

    try {
      const res = await fetch(commentEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text })
      });

      if (res.ok) {
        const data = await res.json();
        setFeedItems(prev =>
          prev.map(f => {
            if (f.id === item.id) {
              return { ...f, comments: [...f.comments, data.comment] };
            }
            return f;
          })
        );
        setCommentInputs(prev => ({ ...prev, [item.id]: "" }));
        addNotification("Success", "Comment posted successfully", "success");
      } else {
        addNotification("Error", "Failed to publish comment", "error");
      }
    } catch {
      addNotification("Error", "Connection error", "error");
    } finally {
      setSubmittingComment(prev => ({ ...prev, [item.id]: false }));
    }
  };

  // Lightbox navigation helpers
  const openLightboxForAttachedMedia = (mediaObj: any, indexOrList?: number | any[]) => {
    if (Array.isArray(indexOrList)) {
      const items: MediaItem[] = indexOrList.map(m => mapToMediaItem(m));
      setActiveLightboxMediaList(items);
      setActiveLightboxIndex(typeof mediaObj === "number" ? mediaObj : 0);
      return;
    }

    const item: MediaItem = mapToMediaItem(mediaObj);
    setActiveLightboxMediaList([item]);
    setActiveLightboxIndex(0);
  };

  const mapToMediaItem = (mObj: any): MediaItem => {
    return {
      id: mObj.id,
      filename: mObj.filename,
      type: mObj.type,
      url: mObj.url,
      thumbnailUrl: mObj.thumbnailUrl,
      size: mObj.size,
      mimeType: mObj.mimeType,
      width: mObj.width,
      height: mObj.height,
      duration: mObj.duration,
      resolution: null,
      isFavorite: false,
      isArchived: false,
      metadata: null,
      createdAt: new Date().toISOString(),
      tags: [],
      comments: mObj.comments || [],
      likes: mObj.likes || [],
      user: mObj.user ? {
        id: mObj.user.id,
        name: mObj.user.name,
        email: mObj.user.email,
        avatarUrl: mObj.user.avatarUrl
      } : undefined
    };
  };

  const handlePrevLightbox = () => {
    if (activeLightboxIndex !== null && activeLightboxIndex > 0) {
      setActiveLightboxIndex(activeLightboxIndex - 1);
    }
  };

  const handleNextLightbox = () => {
    if (activeLightboxIndex !== null && activeLightboxIndex < activeLightboxMediaList.length - 1) {
      setActiveLightboxIndex(activeLightboxIndex + 1);
    }
  };

  const activeLightboxItem = activeLightboxIndex !== null ? activeLightboxMediaList[activeLightboxIndex] : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300 relative min-h-[85vh] pb-24">
      {/* 1. Header Hero Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Newspaper className="text-primary animate-pulse" size={24} /> News Feed
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Browse social updates, direct visual uploads, and public albums from developers across the network.
          </p>
        </div>

        {/* Media search input */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search posts or filename..."
            className="w-full bg-secondary/40 hover:bg-secondary/60 focus:bg-secondary border border-border/40 focus:border-primary/50 text-foreground text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none transition-all placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {/* 2. Top Filter Controls bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/15 border border-border/40 p-2.5 rounded-2xl">
        <div className="flex items-center gap-2">
          {[
            { label: "Community Feed", value: "all" as const },
            { label: "Following Feed", value: "following" as const }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setActiveFilter(item.value)}
              className={`text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer transition-all ${
                activeFilter === item.value
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: "All Content", value: "all" as const },
            { label: "Posts", value: "posts" as const },
            { label: "Photos", value: "photos" as const },
            { label: "Videos", value: "videos" as const },
            { label: "Albums", value: "albums" as const }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setActiveType(item.value)}
              className={`text-[10px] font-extrabold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                activeType === item.value
                  ? "bg-secondary text-foreground border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/20"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. News Feed Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left/Main Content: Posts & Feed Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Post Composer Panel */}
          {user && (
            <div className="glass rounded-3xl p-5 border border-border/60 shadow-md space-y-4">
              <div className="flex gap-3 items-start">
                <UserAvatar
                  avatarUrl={user.avatarUrl}
                  name={user.name}
                  email={user.email}
                  className="w-9 h-9 rounded-full font-bold text-xs shrink-0 shadow-sm"
                />
                <div className="flex-1">
                  <textarea
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder={`What is on your mind, ${user.name || "Owner"}?`}
                    className="w-full bg-secondary/35 hover:bg-secondary/50 focus:bg-secondary border border-border/50 focus:border-primary/40 rounded-2xl p-4 text-xs focus:outline-none text-foreground resize-none min-h-[90px] transition-colors placeholder:text-muted-foreground/60"
                  />
                </div>
              </div>

              {/* Composer Attached Media Preview */}
              {attachedMedia && (
                <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-black/20 aspect-[16/9] group">
                  {attachedMedia.type === "IMAGE" ? (
                    <NextImage
                      src={attachedMedia.url}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <video
                      src={attachedMedia.url}
                      poster={attachedMedia.thumbnailUrl}
                      muted
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  )}
                  {/* Remove attachment trigger */}
                  <button
                    onClick={() => setAttachedMedia(null)}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 border border-white/10 text-white hover:bg-rose-500 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Composer bottom actions */}
              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                <button
                  onClick={openGalleryPicker}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 px-3.5 py-2 rounded-xl transition-all cursor-pointer font-semibold"
                >
                  <ImageIcon size={16} className="text-indigo-500" />
                  Attach Gallery File
                </button>

                <button
                  onClick={handlePublishPost}
                  disabled={composing || (!postContent.trim() && !attachedMedia)}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 shadow-md shadow-primary/10 text-primary-foreground text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-95 transition-all flex items-center gap-1"
                >
                  {composing ? (
                    <>
                      <Loader2 className="animate-spin" size={13} /> Sharing...
                    </>
                  ) : (
                    <>Share Post</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Timeline Posts List */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 font-semibold text-xs text-muted-foreground animate-pulse">
              <Loader2 className="animate-spin text-primary" size={32} />
              RETRIEVING LATEST FEED ITEMS...
            </div>
          ) : feedItems.length === 0 ? (
            <div className="glass rounded-3xl p-12 border border-border/60 shadow-lg text-center space-y-3">
              <Newspaper className="text-primary/20 mx-auto" size={40} />
              <h4 className="text-sm font-black text-foreground">Timeline Feed is Empty</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {searchQuery
                  ? "No post update, album, or photo matches your search term."
                  : "Follow other platform members or write a personal update to start populating the feed timeline."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {feedItems.map((post) => {
                const userLiked = user ? post.likes.some(l => l.userId === user.id) : false;
                const commentsCount = post.comments.length;
                const showComments = !!expandedComments[post.id];

                return (
                  <div
                    key={post.id}
                    className="glass rounded-3xl p-5 border border-border/60 shadow-md space-y-4 animate-in fade-in duration-200"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Link href={`/profile/${post.user.username || post.user.id}`}>
                          <UserAvatar
                            avatarUrl={post.user.avatarUrl}
                            name={post.user.name}
                            email={post.user.email}
                            className="w-10 h-10 rounded-full font-bold text-sm shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </Link>
                        <div>
                          <h4 className="text-xs font-black text-foreground flex items-center flex-wrap gap-1 leading-snug">
                            <Link href={`/profile/${post.user.username || post.user.id}`} className="hover:underline font-extrabold text-foreground">
                              {post.user.name || "Media Owner"}
                            </Link>

                            {/* Meta text based on feed type */}
                            {post.feedType === "ALBUM" && post.albumDetails && (
                              <span className="text-muted-foreground font-normal">
                                created a new album: 
                                <Link 
                                  href={`/albums/${post.id}`}
                                  className="text-primary font-bold hover:underline ml-1"
                                >
                                  {post.albumDetails.name}
                                </Link>
                              </span>
                            )}

                            {post.feedType === "MEDIA" && post.media && (
                              <span className="text-muted-foreground font-normal">
                                shared a new {post.media.type === "VIDEO" ? "video" : "photo"}
                              </span>
                            )}
                          </h4>
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock size={10} /> {new Date(post.createdAt).toLocaleDateString()} at {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Follow Button */}
                      {user && post.user.id !== user.id && (
                        <button
                          onClick={(e) => handleFollowToggle(post.user.id, !!post.user.isFollowing, e)}
                          disabled={followLoadingId === post.user.id}
                          className={`text-[9px] font-extrabold px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                            post.user.isFollowing
                              ? "bg-secondary text-foreground border-border/80 hover:bg-secondary/80"
                              : "bg-primary text-primary-foreground border-primary hover:bg-primary/95"
                          }`}
                        >
                          {followLoadingId === post.user.id ? (
                            <Loader2 className="animate-spin" size={10} />
                          ) : post.user.isFollowing ? (
                            <>
                              <UserCheck size={10} /> Following
                            </>
                          ) : (
                            <>
                              <UserPlus size={10} /> Follow
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Post Content */}
                    {post.content && (
                      <p className="text-xs font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>
                    )}

                    {/* Post Attached Media */}
                    {post.feedType === "POST" && post.media && (
                      post.media.type === "VIDEO" ? (
                        <FeedVideoPlayer
                          src={post.media.url}
                          poster={post.media.thumbnailUrl}
                          className="rounded-2xl border border-border/50 aspect-[16/9]"
                          onClick={() => openLightboxForAttachedMedia(post.media)}
                        />
                      ) : (
                        <div
                          onClick={() => openLightboxForAttachedMedia(post.media)}
                          className="rounded-2xl border border-border/50 overflow-hidden bg-black/40 cursor-pointer group hover:scale-[1.002] transition-all relative aspect-[16/9]"
                        >
                          <NextImage
                            src={post.media.url}
                            alt=""
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 100vw, 600px"
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <span className="text-[10px] bg-primary text-primary-foreground font-black px-3 py-1.5 rounded-xl shadow-lg">
                              Open in Lightbox
                            </span>
                          </div>
                        </div>
                      )
                    )}

                    {/* Media Upload Body (Direct upload type) */}
                    {post.feedType === "MEDIA" && post.media && (
                      post.media.type === "VIDEO" ? (
                        <FeedVideoPlayer
                          src={post.media.url}
                          poster={post.media.thumbnailUrl}
                          className="rounded-2xl border border-border/50 aspect-[16/10]"
                          onClick={() => openLightboxForAttachedMedia(post.media)}
                        />
                      ) : (
                        <div
                          onClick={() => openLightboxForAttachedMedia(post.media)}
                          className="rounded-2xl border border-border/50 overflow-hidden bg-black/40 cursor-pointer group hover:scale-[1.002] transition-all relative aspect-[16/10]"
                        >
                          <NextImage
                            src={post.media.url}
                            alt=""
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 100vw, 600px"
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <span className="text-[10px] bg-primary text-primary-foreground font-black px-3 py-1.5 rounded-xl shadow-lg">
                              Open in Lightbox
                            </span>
                          </div>
                        </div>
                      )
                    )}

                    {/* Album collage grid type */}
                    {post.feedType === "ALBUM" && post.albumMedia && (
                      <MediaCollage
                        media={post.albumMedia}
                        onMediaClick={(idx, list) => openLightboxForAttachedMedia(idx, list)}
                        onSeeAllClick={(list) => openLightboxForAttachedMedia(0, list)}
                      />
                    )}

                    {/* Actions Panel (except Albums which direct clicks to Lightbox comments) */}
                    {post.feedType !== "ALBUM" && (
                      <>
                        {/* Likes/Comments counters */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold border-b border-border/40 pb-3 pt-1">
                          <span className="flex items-center gap-1 text-primary">
                            <Heart size={12} fill="currentColor" /> {post.likes.length} Likes
                          </span>
                          <span>
                            {commentsCount} Comments
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 border-b border-border/40 pb-3">
                          <button
                            onClick={() => handleToggleLike(post)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              userLiked
                                ? "bg-rose-500/10 border border-rose-500/30 text-rose-500"
                                : "border border-border/60 hover:text-foreground text-muted-foreground"
                            }`}
                          >
                            <Heart size={14} fill={userLiked ? "currentColor" : "none"} />
                            {userLiked ? "Liked" : "Like"}
                          </button>

                          <button
                            onClick={() => {
                              setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }));
                            }}
                            className={`flex items-center gap-1.5 px-3.5 py-2 border text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                              showComments
                                ? "bg-primary/5 text-primary border-primary/20"
                                : "border border-border/60 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <MessageSquare size={14} /> Comment
                          </button>
                        </div>

                        {/* Inline Comments timeline */}
                        {showComments && (
                          <div className="space-y-3 pt-1">
                            {post.comments.length > 0 && (
                              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                {post.comments.map((comment) => (
                                  <div key={comment.id} className="flex gap-2.5 items-start text-xs leading-normal">
                                    <Link href={`/profile/${comment.user.username || comment.user.id}`}>
                                      <UserAvatar
                                        avatarUrl={comment.user.avatarUrl}
                                        name={comment.user.name}
                                        email={comment.user.email}
                                        className="w-7 h-7 rounded-full font-bold text-[9px] cursor-pointer hover:opacity-90"
                                      />
                                    </Link>
                                    <div className="bg-secondary/40 border border-border/40 p-2.5 rounded-2xl flex-1 min-w-0">
                                      <div className="flex justify-between items-center mb-0.5">
                                        <Link href={`/profile/${comment.user.username || comment.user.id}`} className="font-extrabold text-[11px] text-foreground hover:underline">
                                          {comment.user.name || "Commenter"}
                                        </Link>
                                        <span className="text-[8px] text-muted-foreground">
                                          {new Date(comment.createdAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground leading-normal break-words">
                                        {comment.content}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Comment Input box */}
                            {user && (
                              <form
                                onSubmit={(e) => handleCommentSubmit(post, e)}
                                className="flex gap-2 items-center"
                              >
                                <UserAvatar
                                  avatarUrl={user.avatarUrl}
                                  name={user.name}
                                  email={user.email}
                                  className="w-7 h-7 rounded-full font-bold text-[9px] shrink-0"
                                />
                                <input
                                  type="text"
                                  value={commentInputs[post.id] || ""}
                                  onChange={(e) =>
                                    setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))
                                  }
                                  placeholder="Write a comment..."
                                  className="flex-1 bg-secondary/35 border border-border/50 focus:border-primary/40 rounded-xl px-3 py-2 text-[11px] text-foreground focus:outline-none placeholder:text-muted-foreground/60"
                                />
                                <button
                                  type="submit"
                                  disabled={submittingComment[post.id] || !(commentInputs[post.id] || "").trim()}
                                  className="p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-all cursor-pointer"
                                >
                                  {submittingComment[post.id] ? (
                                    <Loader2 className="animate-spin" size={12} />
                                  ) : (
                                    <Send size={12} />
                                  )}
                                </button>
                              </form>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Trigger */}
          {hasMore && (
            <div className="pt-4 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-secondary hover:bg-secondary/80 border border-border/60 text-xs font-bold text-foreground rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="animate-spin" size={13} /> Retrieving updates...
                  </>
                ) : (
                  <>Load Older Posts</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Mini Info Cards */}
        <div className="space-y-6">
          {/* Spotlight Card */}
          <div className="glass rounded-3xl p-5 border border-border/60 shadow-md space-y-4 bg-gradient-to-br from-card/70 to-primary/5">
            <h3 className="text-xs font-black tracking-widest text-primary flex items-center gap-1.5 uppercase">
              <Flame size={14} className="text-orange-500 fill-orange-500" /> Platform Spotlight
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              VividGallery unified feed collects real-time uploads and posts across all user nodes. Follow developers and creatives to custom-tailor your Following feed timeline.
            </p>
            <div className="pt-2 border-t border-border/40 flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
              <span>Nodes Live</span>
              <span className="flex items-center gap-1 text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Online
              </span>
            </div>
          </div>

          {/* Quick Stats Panel */}
          {user && (
            <div className="glass rounded-3xl p-5 border border-border/60 shadow-md space-y-3">
              <h3 className="text-xs font-black tracking-widest text-foreground uppercase">
                Your Stats
              </h3>
              <div className="space-y-2 pt-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Total Uploads</span>
                  <span className="font-bold text-foreground">{user.stats?.mediaCount || 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Gallery Files</span>
                  <span className="font-bold text-foreground">{(user.stats?.photosCount || 0) + (user.stats?.videosCount || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Custom Albums</span>
                  <span className="font-bold text-foreground">{user.stats?.albumsCount || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Media Picker Modal Popup */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-border/60 flex justify-between items-center shrink-0">
              <h3 className="text-xs font-black tracking-wider uppercase text-foreground">Select Gallery Media</h3>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content grid */}
            <div className="p-4 overflow-y-auto flex-1 bg-secondary/5 min-h-[300px]">
              {galleryLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : galleryMedia.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center space-y-2">
                  <ImageIcon className="text-muted-foreground/40" size={32} />
                  <p className="text-xs text-muted-foreground font-semibold">Your gallery is empty</p>
                  <p className="text-[10px] text-muted-foreground/60 max-w-xs">Upload photos or videos to your gallery first before attaching them to news feed posts.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {galleryMedia.map((media) => (
                    <div
                      key={media.id}
                      onClick={() => {
                        setAttachedMedia(media);
                        setIsMediaPickerOpen(false);
                      }}
                      className="aspect-square relative rounded-xl border border-border/60 overflow-hidden cursor-pointer bg-black group hover:scale-[1.015] active:scale-98 transition-all"
                    >
                      {media.type === "IMAGE" ? (
                        <NextImage
                          src={media.thumbnailUrl || media.url}
                          alt={media.filename}
                          fill
                          unoptimized
                          className="object-cover group-hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <video
                          src={media.url}
                          poster={media.thumbnailUrl}
                          muted
                          preload="metadata"
                          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[9px] bg-primary text-primary-foreground font-black px-2 py-1 rounded-lg">Select</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Global Lightbox Modal Popup */}
      {activeLightboxIndex !== null && (
        <Lightbox
          media={activeLightboxItem}
          mediaList={activeLightboxMediaList}
          onSelectMedia={(item, index) => setActiveLightboxIndex(index)}
          onClose={() => setActiveLightboxIndex(null)}
          onPrev={activeLightboxIndex > 0 ? handlePrevLightbox : undefined}
          onNext={activeLightboxIndex < activeLightboxMediaList.length - 1 ? handleNextLightbox : undefined}
          onUpdate={() => {
            fetchFeed(page, true);
          }}
        />
      )}
    </div>
  );
}
