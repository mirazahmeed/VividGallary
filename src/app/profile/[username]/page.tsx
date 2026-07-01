"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import dynamic from "next/dynamic";
import NextImage from "next/image";
import UserAvatar from "@/components/layout/UserAvatar";
import type { MediaItem } from "@/components/gallery/Lightbox";

const Lightbox = dynamic(() => import("@/components/gallery/Lightbox"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-md flex items-center justify-center z-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
    </div>
  ),
});
import {
  UserPlus,
  UserCheck,
  UserX,
  UserMinus,
  MessageSquare,
  Clock,
  Heart,
  Send,
  Image as ImageIcon,
  FolderOpen,
  Camera,
  Plus,
  X,
  Loader2,
  Lock,
  Globe,
  Settings,
  Share2,
  Video,
  Upload
} from "lucide-react";

const MediaCollage = dynamic(() => import("@/components/gallery/MediaCollage"), {
  ssr: false,
  loading: () => (
    <div className="py-8 flex justify-center">
      <Loader2 className="animate-spin text-primary" size={20} />
    </div>
  ),
});

interface UserProfileDetails {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
  createdAt: string;
}

interface ProfileStats {
  postsCount: number;
  albumsCount: number;
  friendshipsCount: number;
}

interface PostLike {
  id: string;
  userId: string;
}

interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
}

interface PostItem {
  id: string;
  feedType?: "POST" | "ALBUM";
  albumDetails?: {
    name: string;
    isDefault: boolean;
    visibility: string;
  };
  albumMedia?: any[] | null;
  content: string | null;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    username: string | null;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  media: {
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
  } | null;
  likes: PostLike[];
  comments: PostComment[];
}

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { user: currentUser, searchQuery, addNotification } = useApp();
  const { username: profileUserId } = React.use(params);

  // States
  const [profileUser, setProfileUser] = useState<UserProfileDetails | null>(null);

  const isOwnProfile = currentUser && (
    currentUser.id === profileUserId ||
    (currentUser.username && currentUser.username === profileUserId) ||
    (profileUser && currentUser.id === profileUser.id)
  );
  const [stats, setStats] = useState<ProfileStats>({ postsCount: 0, albumsCount: 0, friendshipsCount: 0 });
  const [profileLoading, setProfileLoading] = useState(true);

  // Friendship state
  const [friendshipStatus, setFriendshipStatus] = useState<string>("NONE"); // NONE, PENDING_SENT, PENDING_RECEIVED, ACCEPTED
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [followActionLoading, setFollowActionLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Posts timeline
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Albums
  const [albums, setAlbums] = useState<any[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);

  // Compose post state
  const [postContent, setPostContent] = useState("");
  const [attachedMedia, setAttachedMedia] = useState<any | null>(null);
  const [composing, setComposing] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [galleryMedia, setGalleryMedia] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  // Friends list modal
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [friendsListLoading, setFriendsListLoading] = useState(false);

  // Comments inputs mapping
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});

  // Lightbox
  const [activeLightboxMedia, setActiveLightboxMedia] = useState<MediaItem | null>(null);
  const [activeLightboxMediaList, setActiveLightboxMediaList] = useState<any[]>([]);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  
  // Album grid modal
  const [activeAlbumMediaListForGrid, setActiveAlbumMediaListForGrid] = useState<any[] | null>(null);
  const [activeAlbumNameForGrid, setActiveAlbumNameForGrid] = useState<string>("");

  const [userMedia, setUserMedia] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);

  // Load profile details on profileUserId change
  useEffect(() => {
    loadProfileDetails();
    
    // Defer loading of non-critical visual albums and user media
    const deferLoad = () => {
      loadAlbums();
      loadUserMedia();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(deferLoad);
    } else {
      setTimeout(deferLoad, 200);
    }
  }, [profileUserId]);

  // Load posts when profileUserId or searchQuery changes
  useEffect(() => {
    loadPosts();
  }, [profileUserId, searchQuery]);

  const loadProfileDetails = async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/users/${profileUserId}`);
      if (res.ok) {
        const data = await res.json();
        setProfileUser(data.user);
        setStats(data.stats);
        setIsFollowing(data.isFollowing || false);
        setFriendshipStatus(data.friendshipStatus || "NONE");
      } else {
        addNotification("Error", "Failed to load profile user details", "error");
      }
    } catch {
      addNotification("Error", "Network error loading profile details", "error");
    } finally {
      setProfileLoading(false);
    }
  };

  const loadPosts = async () => {
    setPostsLoading(true);
    try {
      let url = `/api/posts?userId=${profileUserId}`;
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch {
      addNotification("Error", "Could not load posts history", "error");
    } finally {
      setPostsLoading(false);
    }
  };

  const loadAlbums = async () => {
    setAlbumsLoading(true);
    try {
      const res = await fetch(`/api/albums?userId=${profileUserId}`);
      if (res.ok) {
        const data = await res.json();
        setAlbums(data.albums || []);
      }
    } catch (err) {
      console.error("Failed to load albums:", err);
    } finally {
      setAlbumsLoading(false);
    }
  };

  const loadUserMedia = async () => {
    setMediaLoading(true);
    try {
      const res = await fetch(`/api/media?userId=${profileUserId}`);
      if (res.ok) {
        const data = await res.json();
        setUserMedia(data.media || []);
      }
    } catch (err) {
      console.error("Failed to load user media:", err);
    } finally {
      setMediaLoading(false);
    }
  };

  // Open friends list modal
  const openFriendsModal = async () => {
    setIsFriendsModalOpen(true);
    setFriendsListLoading(true);
    try {
      const res = await fetch(`/api/friends?userId=${profileUserId}`);
      if (res.ok) {
        const data = await res.json();
        setFriendsList(data.friends || []);
      }
    } catch {
      addNotification("Error", "Could not fetch friends list", "error");
    } finally {
      setFriendsListLoading(false);
    }
  };

  // Friend actions: send or accept request
  const handleFriendRequestAction = async () => {
    if (isOwnProfile || friendActionLoading) return;
    setFriendActionLoading(true);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: profileUserId })
      });

      if (res.ok) {
        const data = await res.json();
        setFriendshipStatus(data.status);
        if (data.status === "ACCEPTED") {
          addNotification("Friends", "You are now friends!", "success");
          // Increment friends count locally
          setStats(prev => ({ ...prev, friendshipsCount: prev.friendshipsCount + 1 }));
        } else {
          addNotification("Sent", "Friend request sent successfully", "success");
        }
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Action failed", "error");
      }
    } catch {
      addNotification("Error", "Network request failed", "error");
    } finally {
      setFriendActionLoading(false);
    }
  };

  // Decline/Cancel/Unfriend action
  const handleRemoveFriendAction = async () => {
    if (isOwnProfile || friendActionLoading) return;
    setFriendActionLoading(true);
    setShowUnfriendConfirm(false);
    try {
      const res = await fetch(`/api/friends?userId=${profileUserId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setFriendshipStatus("NONE");
        addNotification("Removed", "Friendship or request cancelled", "info");
        // Decrement friends count if they were accepted friends
        if (friendshipStatus === "ACCEPTED") {
          setStats(prev => ({ ...prev, friendshipsCount: Math.max(0, prev.friendshipsCount - 1) }));
        }
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Action failed", "error");
      }
    } catch {
      addNotification("Error", "Network request failed", "error");
    } finally {
      setFriendActionLoading(false);
    }
  };

  // Follow/Unfollow action
  const handleFollowToggle = async () => {
    if (isOwnProfile || followActionLoading) return;
    setFollowActionLoading(true);
    try {
      const res = await fetch("/api/follow", {
        method: isFollowing ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: profileUserId })
      });
      if (res.ok) {
        setIsFollowing(!isFollowing);
        addNotification(
          "Success",
          isFollowing ? "Unfollowed user successfully" : "Followed user successfully",
          "success"
        );
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to update follow", "error");
      }
    } catch {
      addNotification("Error", "Failed to update follow status", "error");
    } finally {
      setFollowActionLoading(false);
    }
  };

  // Upload from device action
  const handleUploadFromDevice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setComposing(true);
      try {
        const file = e.target.files[0];
        const fd = new FormData();
        fd.append("files", file);
        fd.append("visibility", "PUBLIC");

        const res = await fetch("/api/media/upload", {
          method: "POST",
          body: fd
        });

        if (res.ok) {
          const data = await res.json();
          if (data.media && data.media.length > 0) {
            setAttachedMedia(data.media[0]);
            addNotification("Uploaded", "Media uploaded and attached to post", "success");
          }
        } else {
          const err = await res.json();
          addNotification("Upload Failed", err.error || "Failed to upload file", "error");
        }
      } catch (err: any) {
        addNotification("Upload Failed", err.message || "Failed to process upload", "error");
      } finally {
        setComposing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  // Like dynamic toggle
  const handleTogglePostLike = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev =>
          prev.map(p => {
            if (p.id === postId) {
              const newLikes = data.liked
                ? [...p.likes, { id: Math.random().toString(), userId: currentUser?.id || "" }]
                : p.likes.filter(l => l.userId !== currentUser?.id);
              return { ...p, likes: newLikes };
            }
            return p;
          })
        );
      }
    } catch (err) {
      console.error("Failed to toggle post like:", err);
    }
  };

  // Submit comment to post
  const handleSubmitComment = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    // Clear input
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));

    try {
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text })
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(prev =>
          prev.map(p => {
            if (p.id === postId) {
              return { ...p, comments: [...p.comments, data.comment] };
            }
            return p;
          })
        );
      } else {
        addNotification("Error", "Could not submit comment", "error");
      }
    } catch {
      addNotification("Error", "Connection error", "error");
    }
  };

  // Load user's media for compose attachment
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

  // Post composer submit
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
        setPosts(prev => [data.post, ...prev]);
        setPostContent("");
        setAttachedMedia(null);
        addNotification("Success", "Post shared to timeline", "success");
        // Update stats
        setStats(prev => ({ ...prev, postsCount: prev.postsCount + 1 }));
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

  const openLightboxForAttachedMedia = (mediaObj: any, indexOrList?: number | any[]) => {
    if (Array.isArray(indexOrList)) {
      setActiveLightboxMediaList(indexOrList);
      setActiveLightboxIndex(typeof mediaObj === "number" ? mediaObj : 0);
      return;
    }

    const item: MediaItem = {
      id: mediaObj.id,
      filename: mediaObj.filename,
      type: mediaObj.type,
      url: mediaObj.url,
      thumbnailUrl: mediaObj.thumbnailUrl,
      size: mediaObj.size,
      mimeType: mediaObj.mimeType,
      width: mediaObj.width,
      height: mediaObj.height,
      duration: mediaObj.duration,
      resolution: null,
      isFavorite: false,
      isArchived: false,
      metadata: null,
      createdAt: new Date().toISOString(),
      tags: [],
      comments: [],
      likes: []
    };
    setActiveLightboxMediaList([item]);
    setActiveLightboxIndex(0);
  };

  if (profileLoading) {
    return (
      <div className="h-[70vh] flex flex-col justify-center items-center gap-3">
        <Loader2 className="animate-spin text-primary" size={36} />
        <p className="text-sm font-semibold text-muted-foreground">Retrieving profile timeline...</p>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="h-[70vh] flex flex-col justify-center items-center text-center p-6 space-y-3">
        <UserX size={48} className="text-destructive animate-pulse" />
        <h2 className="text-lg font-black text-foreground">User Profile Not Found</h2>
        <p className="text-xs text-muted-foreground max-w-sm">
          The requested profile page could not be located in our database directories. It may have been deleted or moved.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* 1. cover Section & Profile Overview */}
      <div className="glass border border-border/60 rounded-3xl overflow-hidden shadow-xl">
        {/* Banner cover background */}
        <div className="h-44 sm:h-56 bg-gradient-to-r from-primary/30 via-accent/30 to-secondary relative flex items-end p-6 border-b border-border/30">
          <div className="absolute top-4 right-4 bg-black/45 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow">
            <Globe size={11} className="text-primary animate-pulse" /> Public Portfolio
          </div>
        </div>

        {/* Profile Avatar, Info & Friend Status Button row */}
        <div className="p-6 pt-0 relative flex flex-col md:flex-row items-center md:items-end justify-between gap-6 md:gap-4">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-5 -mt-16 md:-mt-10 md:pl-2">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-4 border-card bg-card shadow-lg relative overflow-hidden flex items-center justify-center shrink-0">
              <UserAvatar
                avatarUrl={profileUser.avatarUrl}
                name={profileUser.name}
                email={profileUser.email}
                className="w-full h-full font-black text-4xl shadow-inner rounded-2xl"
              />
            </div>
            
            <div className="text-center md:text-left space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-black text-foreground">{profileUser.name || "Media Owner"}</h1>
              <p className="text-xs text-muted-foreground">{profileUser.email}</p>
              {profileUser.bio && (
                <p className="text-xs text-foreground font-medium italic mt-1.5 max-w-md">
                  "{profileUser.bio}"
                </p>
              )}
            </div>
          </div>

          {/* Dynamic Friend Actions button (only on other profiles) */}
          <div className="shrink-0 flex items-center gap-2.5">
            {!isOwnProfile ? (
              <>
                {friendshipStatus === "NONE" && (
                  <button
                    onClick={handleFriendRequestAction}
                    disabled={friendActionLoading}
                    className="flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <UserPlus size={15} /> Add Friend
                  </button>
                )}

                {friendshipStatus === "PENDING_SENT" && (
                  <button
                    onClick={handleRemoveFriendAction}
                    disabled={friendActionLoading}
                    className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <UserX size={15} /> Cancel Request
                  </button>
                )}

                {friendshipStatus === "PENDING_RECEIVED" && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleFriendRequestAction}
                      disabled={friendActionLoading}
                      className="flex items-center gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer transition-all active:scale-95"
                    >
                      <UserCheck size={15} /> Accept Request
                    </button>
                    <button
                      onClick={handleRemoveFriendAction}
                      disabled={friendActionLoading}
                      className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-destructive border border-border font-bold text-xs px-3 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95"
                    >
                      Decline
                    </button>
                  </div>
                )}

                {friendshipStatus === "ACCEPTED" && (
                  <div className="relative">
                    {showUnfriendConfirm ? (
                      <div className="flex gap-2">
                        <button
                          onClick={handleRemoveFriendAction}
                          disabled={friendActionLoading}
                          className="bg-destructive text-destructive-foreground font-bold text-[10px] px-3 py-2 rounded-xl transition-all cursor-pointer shadow"
                        >
                          Confirm Unfriend
                        </button>
                        <button
                          onClick={() => setShowUnfriendConfirm(false)}
                          className="bg-secondary border border-border text-foreground font-bold text-[10px] px-3 py-2 rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowUnfriendConfirm(true)}
                        className="flex items-center gap-1.5 bg-emerald-600/10 border border-emerald-500/30 text-emerald-500 font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-all cursor-pointer hover:bg-emerald-600/20"
                      >
                        <UserCheck size={15} /> Friends (Click to Unfriend)
                      </button>
                    )}
                  </div>
                )}
                
                {/* Follow button */}
                <button
                  onClick={handleFollowToggle}
                  disabled={followActionLoading}
                  className={`flex items-center gap-1.5 font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50 ${
                    isFollowing
                      ? "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
                      : "bg-primary hover:bg-primary/95 text-white"
                  }`}
                >
                  {isFollowing ? <UserCheck size={15} /> : <UserPlus size={15} />}
                  {isFollowing ? "Following" : "Follow"}
                </button>

                <Link
                  href={`/chat`}
                  className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-xs px-4 py-2.5 rounded-xl shadow transition-all"
                >
                  <MessageSquare size={15} /> Message
                </Link>
              </>
            ) : (
              <Link
                href="/settings"
                className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer transition-all"
              >
                <Settings size={15} /> Edit Settings
              </Link>
            )}
          </div>
        </div>

        {/* Display Stats Row */}
        <div className="flex border-t border-border/40 divide-x divide-border/40 text-center select-none bg-muted/10 shrink-0">
          <div className="flex-1 py-4.5 space-y-1">
            <span className="block text-lg font-black text-foreground">{stats.postsCount}</span>
            <span className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Posts shared</span>
          </div>
          
          <button
            onClick={openFriendsModal}
            className="flex-1 py-4.5 space-y-1 hover:bg-secondary/20 transition-colors cursor-pointer text-center"
          >
            <span className="block text-lg font-black text-foreground">{stats.friendshipsCount}</span>
            <span className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-1 text-primary hover:text-primary-foreground">
              Friends List
            </span>
          </button>
          
          <div className="flex-1 py-4.5 space-y-1">
            <span className="block text-lg font-black text-foreground">{stats.albumsCount}</span>
            <span className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">Albums created</span>
          </div>
        </div>
      </div>

      {/* 2. Page Content: Left info side column, right posts timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Albums display */}
        <div className="lg:col-span-1 space-y-6">
          {/* 1. Photos Grid Card (Facebook-style) */}
          <div className="glass rounded-3xl p-5 border border-border/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-xs font-black text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <ImageIcon size={14} className="text-primary animate-pulse" /> Photos
              </h3>
              <Link
                href="/gallery"
                className="text-[10px] font-extrabold text-primary hover:text-primary/80 uppercase tracking-wider"
              >
                See all photos
              </Link>
            </div>

            {mediaLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="animate-spin text-primary" size={20} />
              </div>
            ) : userMedia.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 leading-relaxed">
                No uploaded photos or videos found.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {userMedia.slice(0, 9).map((mediaItem, idx) => (
                  <button
                    key={mediaItem.id}
                    onClick={() => openLightboxForAttachedMedia(idx, userMedia.slice(0, 9))}
                    className="group relative overflow-hidden aspect-square rounded-2xl border border-border hover:border-primary/40 bg-zinc-950/80 cursor-pointer block w-full"
                  >
                    {mediaItem.type === "VIDEO" ? (
                      <video
                        src={`${mediaItem.url}#t=0.1`}
                        preload="metadata"
                        muted
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <NextImage
                        src={mediaItem.thumbnailUrl || mediaItem.url}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 33vw, 120px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )}
                    
                    {/* Hover Zoom overlay icon */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] bg-primary text-primary-foreground px-2 py-0.5 rounded font-black">
                        View
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="glass rounded-3xl p-5 border border-border/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-xs font-black text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <FolderOpen size={14} className="text-primary animate-pulse" /> Photo Albums
              </h3>
              <span className="text-[10px] font-extrabold text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full">
                {albums.length}
              </span>
            </div>

            {albumsLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="animate-spin text-primary" size={20} />
              </div>
            ) : albums.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 leading-relaxed">
                No album collections made public by this creator yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {albums.slice(0, 6).map((album) => (
                  <Link
                    key={album.id}
                    href={`/albums/${album.id}`}
                    className="group relative overflow-hidden aspect-[4/3] rounded-2xl border border-border hover:border-primary/40 bg-zinc-950/80 cursor-pointer block"
                  >
                    {album.coverMedia ? (
                      album.coverMedia.type === "VIDEO" ? (
                        <video
                          src={`${album.coverMedia.url}#t=0.1`}
                          preload="metadata"
                          muted
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <NextImage
                          src={album.coverMedia.url}
                          alt=""
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                        <FolderOpen size={18} className="text-primary mb-1" />
                      </div>
                    )}
                    
                    {/* Shadow overlay details */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent p-2.5 flex flex-col justify-end">
                      <p className="text-[10px] font-bold text-white truncate w-full group-hover:text-primary transition-colors">
                        {album.name}
                      </p>
                      <span className="text-[8px] font-extrabold text-white/50 block mt-0.5">
                        {album._count?.media || 0} files
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline Composer and Posts Feed */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Post Composer (Only shown on own profile) */}
          {isOwnProfile && (
            <div className="glass rounded-3xl p-5 border border-border/60 shadow-md">
              <form onSubmit={handlePublishPost} className="space-y-4">
                <div className="flex gap-3">
                  <UserAvatar
                    avatarUrl={currentUser.avatarUrl}
                    name={currentUser.name}
                    email={currentUser.email}
                    className="w-9 h-9 rounded-full font-bold text-xs"
                  />
                  <textarea
                    placeholder="What's on your mind? Share text or attach gallery media..."
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="w-full bg-secondary/30 border border-border/40 focus:border-primary/50 text-foreground text-xs p-3.5 rounded-2xl focus:outline-none min-h-[90px] resize-none font-semibold leading-relaxed"
                  />
                </div>

                {/* Attached media preview */}
                {attachedMedia && (
                  <div className="relative rounded-2xl overflow-hidden border border-border max-w-sm bg-black/45 shadow ml-12">
                    <button
                      type="button"
                      onClick={() => setAttachedMedia(null)}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-lg border border-white/10 text-white cursor-pointer hover:bg-black"
                    >
                      <X size={12} />
                    </button>
                    {attachedMedia.type === "IMAGE" ? (
                      <NextImage
                        src={attachedMedia.url}
                        alt=""
                        width={384}
                        height={192}
                        unoptimized
                        className="w-full h-auto max-h-48 object-cover"
                      />
                    ) : (
                      <div className="p-4 flex flex-col items-center justify-center text-center">
                        <Video className="text-primary mb-1 animate-pulse" size={24} />
                        <span className="text-[10px] font-bold text-white truncate max-w-[200px]">{attachedMedia.filename}</span>
                        <span className="text-[8px] bg-black/60 px-1.5 py-0.5 rounded font-bold text-white/50 mt-1">VIDEO</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/40 pt-3 pl-12">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={openGalleryPicker}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary text-xs font-bold transition-colors cursor-pointer"
                    >
                      <ImageIcon size={16} /> Attach Media
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-primary text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Upload size={16} /> Upload from Device
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleUploadFromDevice}
                      accept="image/*,video/*"
                      className="hidden"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={composing || (!postContent.trim() && !attachedMedia)}
                    className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs px-5 py-2 rounded-xl shadow cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {composing ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={13} />
                    )}
                    Publish Post
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Posts Timeline List */}
          <div className="space-y-6">
            {postsLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="animate-spin text-primary" size={28} />
              </div>
            ) : posts.length === 0 ? (
              <div className="glass rounded-3xl p-10 border border-border/60 shadow-sm text-center space-y-2">
                <MessageSquare className="text-primary/30 mx-auto" size={32} />
                <h4 className="text-sm font-bold text-foreground">No Timeline Posts</h4>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-normal">
                  There are no updates posted on this user's timeline feed.
                </p>
              </div>
            ) : (
              posts.map((post) => {
                const userLiked = post.likes.some(l => l.userId === currentUser?.id);
                
                return (
                  <div
                    key={post.id}
                    className="glass rounded-3xl p-5 border border-border/60 shadow-md space-y-4 animate-in fade-in duration-200"
                  >
                    {/* Post Author Card Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          avatarUrl={post.user.avatarUrl}
                          name={post.user.name}
                          email={post.user.email}
                          className="w-10 h-10 rounded-full font-bold text-sm shadow-sm"
                        />
                        <div>
                          <h4 className="text-xs font-black text-foreground">
                            {post.user.name || "Media Owner"}
                            {post.feedType === "ALBUM" && post.albumDetails && (
                              <span className="text-muted-foreground font-normal ml-1">
                                created a new album: 
                                <Link 
                                  href={`/albums/${post.id}`}
                                  className="text-primary font-bold hover:underline ml-1"
                                >
                                  {post.albumDetails.name}
                                </Link>
                              </span>
                            )}
                          </h4>
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock size={10} /> {new Date(post.createdAt).toLocaleDateString()} at {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Post Text content description */}
                    {post.content && (
                      <p className="text-xs font-medium text-foreground leading-relaxed whitespace-pre-wrap">
                        {post.content}
                      </p>
                    )}

                    {/* Post Attached Media */}
                    {post.media && (
                      <div
                        onClick={() => openLightboxForAttachedMedia(post.media)}
                        className="rounded-2xl border border-border/50 overflow-hidden bg-black/40 cursor-pointer group hover:scale-[1.005] active:scale-[0.995] transition-all relative"
                      >
                        {post.media.type === "IMAGE" ? (
                          <NextImage
                            src={post.media.url}
                            alt=""
                            width={800}
                            height={400}
                            unoptimized
                            sizes="(max-width: 640px) 100vw, 600px"
                            className="w-full h-auto max-h-96 object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-[16/9] bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                            <Video className="text-primary mb-1 animate-pulse" size={32} />
                            <p className="text-xs font-bold text-white max-w-sm truncate">{post.media.filename}</p>
                            <span className="text-[9px] bg-black/60 px-2 py-0.5 rounded font-black text-white/50 mt-1">VIDEO</span>
                          </div>
                        )}
                        {/* Lightbox Trigger Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <span className="text-[10px] bg-primary text-primary-foreground font-black px-3 py-1.5 rounded-xl shadow-lg">
                            Open in Lightbox
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Album Collage Media Grid */}
                    {post.feedType === "ALBUM" && post.albumMedia && (
                      <MediaCollage
                        media={post.albumMedia}
                        onMediaClick={openLightboxForAttachedMedia}
                        onSeeAllClick={(list) => {
                          setActiveAlbumMediaListForGrid(list);
                          setActiveAlbumNameForGrid(post.albumDetails?.name || "Album Gallery");
                        }}
                      />
                    )}

                    {post.feedType === "POST" && (
                      <>
                        {/* Likes and comments action counts */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold border-b border-border/40 pb-3 pt-1">
                          <span className="flex items-center gap-1 text-primary">
                            <Heart size={12} fill="currentColor" /> {post.likes.length} Likes
                          </span>
                          <span>
                            {post.comments.length} Comments
                          </span>
                        </div>

                        {/* Post Action Buttons */}
                        <div className="flex items-center gap-3 border-b border-border/40 pb-3">
                          <button
                            onClick={() => handleTogglePostLike(post.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                              const input = document.getElementById(`comment-input-${post.id}`);
                              input?.focus();
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 border border-border/60 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer rounded-xl"
                          >
                            <MessageSquare size={14} /> Comment
                          </button>
                        </div>

                        {/* Comments section list feed */}
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
                                      className="w-7 h-7 rounded-full font-bold text-[9px] cursor-pointer"
                                    />
                                  </Link>
                                  <div className="flex-1 bg-secondary/40 border border-border/30 rounded-2xl px-3 py-2.5 space-y-0.5">
                                    <div className="flex justify-between items-baseline">
                                      <Link href={`/profile/${comment.user.username || comment.user.id}`} className="font-extrabold text-foreground hover:text-primary truncate block max-w-[120px]">
                                        {comment.user.name || "Media Owner"}
                                      </Link>
                                      <span className="text-[8px] text-muted-foreground">
                                        {new Date(comment.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-muted-foreground font-medium">{comment.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Comment Input Box */}
                          <form onSubmit={(e) => handleSubmitComment(e, post.id)} className="flex gap-2">
                            <input
                              id={`comment-input-${post.id}`}
                              type="text"
                              placeholder="Write a comment secure post..."
                              value={commentInputs[post.id] || ""}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                              className="flex-1 bg-secondary/30 border border-border/60 focus:border-primary/50 text-foreground text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                            />
                            <button
                              type="submit"
                              disabled={!commentInputs[post.id]?.trim()}
                              className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 cursor-pointer flex items-center justify-center"
                            >
                              <Send size={12} />
                            </button>
                          </form>
                        </div>
                      </>
                    )}

                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* 3. Modal Popup: Friends List list */}
      {isFriendsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <UserCheck size={16} className="text-primary" /> Profile Friends list
              </h3>
              
              <button
                onClick={() => setIsFriendsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-4 space-y-2.5">
              {friendsListLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : friendsList.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 leading-relaxed">
                  No friends added to directories list.
                </p>
              ) : (
                friendsList.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/profile/${friend.username || friend.id}`}
                    onClick={() => setIsFriendsModalOpen(false)}
                    className="flex items-center gap-3 p-2 rounded-2xl hover:bg-secondary/40 transition-colors block text-left"
                  >
                    <UserAvatar
                      avatarUrl={friend.avatarUrl}
                      name={friend.name}
                      email={friend.email}
                      className="w-10 h-10 rounded-full font-bold text-sm shadow-sm"
                    />
                    <div className="truncate flex-1">
                      <p className="text-xs font-bold text-foreground truncate hover:text-primary transition-colors">
                        {friend.name || "Media Owner"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{friend.email}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal Picker: Compose Attachment picker */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <ImageIcon size={16} className="text-primary" /> Select Gallery Media to Attach
              </h3>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto p-4">
              {galleryLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : galleryMedia.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 leading-relaxed">
                  No uploads available in your dashboard directory.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {galleryMedia.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setAttachedMedia(item);
                        setIsMediaPickerOpen(false);
                      }}
                      className="group overflow-hidden rounded-xl border border-border hover:border-primary transition-all aspect-square relative bg-zinc-950 flex flex-col justify-between"
                    >
                      {item.type === "IMAGE" ? (
                        <img
                          src={item.thumbnailUrl || item.url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-white/50">
                          <Video size={20} className="text-primary" />
                          <span className="text-[7px] bg-black/60 px-1 py-0.5 rounded font-black text-white/50 mt-1 truncate max-w-[80px]">
                            VIDEO
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] bg-primary text-primary-foreground px-2 py-0.5 rounded font-black">
                          Attach
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Album Grid Modal */}
      {activeAlbumMediaListForGrid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 md:p-10 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">{activeAlbumNameForGrid}</h3>
                <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">{activeAlbumMediaListForGrid.length} files in this album</p>
              </div>
              <button
                onClick={() => {
                  setActiveAlbumMediaListForGrid(null);
                  setActiveAlbumNameForGrid("");
                }}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer border border-zinc-700/50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Gallery Grid */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {activeAlbumMediaListForGrid.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      openLightboxForAttachedMedia(idx, activeAlbumMediaListForGrid);
                    }}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 hover:border-primary/40 bg-zinc-950 aspect-square cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    {item.type === "VIDEO" ? (
                      <div className="w-full h-full relative">
                        <video
                          src={`${item.url}#t=0.1`}
                          preload="metadata"
                          className="w-full h-full object-cover pointer-events-none"
                          muted
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white border border-white/10">
                            <Video size={14} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={item.filename}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <span className="text-[9px] bg-primary text-primary-foreground font-black px-2.5 py-1.5 rounded-xl shadow-lg">
                        View Item
                      </span>
                    </div>

                    {/* Bottom filename overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <p className="text-[10px] text-white font-bold truncate">{item.filename}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox full-fidelity display */}
      {activeLightboxIndex !== null && activeLightboxMediaList.length > 0 && (
        <Lightbox
          media={activeLightboxMediaList[activeLightboxIndex]}
          mediaList={activeLightboxMediaList}
          onSelectMedia={(item, idx) => setActiveLightboxIndex(idx)}
          onClose={() => {
            setActiveLightboxIndex(null);
            setActiveLightboxMediaList([]);
          }}
          onPrev={activeLightboxIndex > 0 ? () => setActiveLightboxIndex(activeLightboxIndex - 1) : undefined}
          onNext={activeLightboxIndex < activeLightboxMediaList.length - 1 ? () => setActiveLightboxIndex(activeLightboxIndex + 1) : undefined}
          hideSuggestions={true}
        />
      )}

    </div>
  );
}
