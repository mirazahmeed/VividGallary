"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import Lightbox, { MediaItem } from "@/components/gallery/Lightbox";
import UserAvatar from "@/components/layout/UserAvatar";
import {
  Image as PhotoIcon,
  Video as VideoIcon,
  Heart,
  MessageSquare,
  Loader2,
  SlidersHorizontal,
  Compass,
  UserPlus,
  UserMinus,
  UserCheck,
  Search
} from "lucide-react";

export default function ExplorePage() {
  const { user, mediaSearchQuery, setMediaSearchQuery, addNotification } = useApp();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>("ALL"); // ALL, IMAGE, VIDEO
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);

  // Load and refresh media list dynamically
  useEffect(() => {
    if (user) {
      fetchMedia();
    }
  }, [user, activeType, mediaSearchQuery]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      let url = `/api/explore?type=${activeType !== "ALL" ? activeType : ""}`;
      if (mediaSearchQuery) url += `&search=${mediaSearchQuery}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMediaItems(data.media);
      }
    } catch {
      addNotification("Error", "Failed to fetch explore feed", "error");
    } finally {
      setLoading(false);
    }
  };

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
        // Toggle the isFollowing flag for all media items from this user
        setMediaItems((prev) =>
          prev.map((item) => {
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
    <div className="space-y-6 animate-in fade-in duration-300 relative min-h-[80vh]">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Compass className="text-primary animate-pulse" size={24} /> Explore Community
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Discover public albums and photos shared by creators across the network.
          </p>
        </div>

        {/* Media Search bar input */}
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="text"
            value={mediaSearchQuery}
            onChange={(e) => setMediaSearchQuery(e.target.value)}
            placeholder="Search community media..."
            className="w-full bg-secondary/40 hover:bg-secondary/60 focus:bg-secondary border border-border/40 focus:border-primary/50 text-foreground text-xs pl-9 pr-3 py-2 rounded-xl focus:outline-none transition-all placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Media type selectors */}
        <div className="flex items-center gap-3.5">
          <div className="flex border border-border/60 bg-muted/20 p-1 rounded-xl">
            {[
              { label: "All Feed", type: "ALL" },
              { label: "Photos", type: "IMAGE" },
              { label: "Videos", type: "VIDEO" },
            ].map((type) => (
              <button
                key={type.type}
                onClick={() => setActiveType(type.type)}
                className={`text-[11px] font-bold px-4 py-2 rounded-lg cursor-pointer transition-all ${
                  activeType === type.type
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Grid Render list */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs font-bold animate-pulse">
          <Loader2 className="animate-spin text-primary" size={32} />
          LOADING DISCOVER FEED...
        </div>
      ) : mediaItems.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-card/10 border-2 border-dashed border-border/60 rounded-3xl">
          <Compass size={36} className="text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-extrabold text-foreground mb-1">No community posts yet</h3>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            {mediaSearchQuery
              ? "No public files match your search query."
              : "When other users publish files as PUBLIC, they will appear in this global explore catalog."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-24">
          {mediaItems.map((item, index) => {
            const isFollowing = !!item.user?.isFollowing;
            const followLoading = followLoadingId === item.user?.id;

            return (
              <div
                key={item.id}
                onClick={() => setActiveLightboxIndex(index)}
                className="group relative overflow-hidden rounded-3xl cursor-pointer shadow-md transition-all duration-300 border border-border/60 bg-card hover:scale-[1.015] hover:shadow-xl flex flex-col h-[340px]"
              >
                {/* Media Preview Container */}
                <div className="relative flex-1 bg-secondary/15 overflow-hidden">
                  {item.type === "IMAGE" ? (
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.filename}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  ) : (
                    <div className="w-full h-full relative group-hover:scale-105 transition-transform duration-500">
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={item.filename}
                        loading="lazy"
                        className="w-full h-full object-cover"
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

                  {/* Likes / Comments Counters Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between text-white">
                    <span className="text-[10px] font-semibold truncate max-w-[140px]">
                      {item.filename}
                    </span>
                    <div className="flex items-center gap-3 shrink-0 text-[10px] font-bold">
                      <span className="flex items-center gap-1">
                        <Heart size={12} fill="currentColor" className="text-rose-500" />
                        {item.likes?.length || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} fill="currentColor" className="text-primary" />
                        {item.comments?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer User Info */}
                {item.user && (
                  <div className="p-4 flex items-center justify-between border-t border-border/50 bg-card/90 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        avatarUrl={item.user.avatarUrl}
                        name={item.user.name}
                        email={item.user.email}
                        className="w-8 h-8 rounded-full text-xs font-black"
                      />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-foreground truncate leading-tight">
                          {item.user.name || "Anonymous"}
                        </p>
                        <p className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                          {item.user.email}
                        </p>
                      </div>
                    </div>

                    {user && item.user.id !== user.id && (
                      <button
                        onClick={(e) => handleFollowToggle(item.user!.id, isFollowing, e)}
                        disabled={followLoading}
                        className={`text-[9px] font-extrabold px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          isFollowing
                            ? "bg-secondary text-foreground border-border/80 hover:bg-secondary/80"
                            : "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                        }`}
                      >
                        {followLoading ? (
                          <Loader2 className="animate-spin" size={10} />
                        ) : isFollowing ? (
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
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Global Lightbox Modal */}
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
    </div>
  );
}
