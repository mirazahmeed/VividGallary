"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Key,
  Settings,
  Share2,
  Copy,
  X,
  CheckSquare,
  Square,
  ArrowUpDown
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
  isDefault: boolean;
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

  // Page States
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Password states
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [verifiedPassword, setVerifiedPassword] = useState<string | null>(null);

  // Manage Album Modal states
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageTab, setManageTab] = useState<"general" | "collaborators" | "shares">("general");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState("PRIVATE");
  const [editPassword, setEditPassword] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Collaborator invitation states
  const [collabEmail, setCollabEmail] = useState("");
  const [collabRole, setCollabRole] = useState<"VIEWER" | "CONTRIBUTOR" | "EDITOR">("VIEWER");
  const [submittingCollab, setSubmittingCollab] = useState(false);

  // Share link states
  const [sharesList, setSharesList] = useState<any[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [shareDurationDays, setShareDurationDays] = useState<number | null>(null);
  const [shareDownloadPermission, setShareDownloadPermission] = useState(true);
  const [generatingShare, setGeneratingShare] = useState(false);

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

  // Sorting state
  const [sortBy, setSortBy] = useState<"date" | "name" | "size" | "kind">("date");

  const sortedJointItems = React.useMemo(() => {
    if (!album) return [];
    const items = [...album.media];
    items.sort((a, b) => {
      if (sortBy === "name") {
        return a.media.filename.localeCompare(b.media.filename);
      }
      if (sortBy === "size") {
        return b.media.size - a.media.size; // Largest first
      }
      if (sortBy === "kind") {
        const typeCompare = a.media.type.localeCompare(b.media.type);
        if (typeCompare !== 0) return typeCompare;
        return a.media.filename.localeCompare(b.media.filename);
      }
      // Default: date (addedAt) - newest first
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
    return items;
  }, [album, sortBy]);

  useEffect(() => {
    if (user && albumId) {
      fetchAlbumDetail();
    }
  }, [user, albumId]);

  const fetchAlbumDetail = async (pwdAttempt?: string) => {
    setLoading(true);
    try {
      const activePassword = pwdAttempt || verifiedPassword;
      const url = activePassword 
        ? `/api/albums/${albumId}?password=${encodeURIComponent(activePassword)}` 
        : `/api/albums/${albumId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setAlbum(data.album);
        setEditName(data.album.name);
        setEditDescription(data.album.description || "");
        setEditVisibility(data.album.visibility);
        if (activePassword) {
          setVerifiedPassword(activePassword);
        }
        setPasswordRequired(false);
      } else if (res.status === 401 && data.passwordRequired) {
        setPasswordRequired(true);
      } else {
        addNotification("Access Denied", data.error || "Folder access denied or requires verification", "warning");
        router.push("/albums");
      }
    } catch {
      addNotification("Error", "Failed to retrieve album detail", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setVerifyingPassword(true);
    await fetchAlbumDetail(password);
    setVerifyingPassword(false);
  };

  const fetchShares = async () => {
    setLoadingShares(true);
    try {
      const res = await fetch("/api/shares");
      if (res.ok) {
        const data = await res.json();
        const albumShares = data.shares.filter((s: any) => s.albumId === albumId);
        setSharesList(albumShares);
      }
    } catch {
      addNotification("Error", "Failed to load share links", "error");
    } finally {
      setLoadingShares(false);
    }
  };

  useEffect(() => {
    if (showManageModal && manageTab === "shares") {
      fetchShares();
    }
  }, [showManageModal, manageTab]);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collabEmail.trim()) return;
    setSubmittingCollab(true);
    try {
      const res = await fetch(`/api/albums/${albumId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: collabEmail, role: collabRole }),
      });
      const data = await res.json();
      if (res.ok) {
        addNotification("Success", `Collaborator ${collabEmail} invited successfully`, "success");
        setCollabEmail("");
        fetchAlbumDetail();
      } else {
        addNotification("Error", data.error || "Failed to add collaborator", "error");
      }
    } catch {
      addNotification("Error", "Failed to add collaborator", "error");
    } finally {
      setSubmittingCollab(false);
    }
  };

  const handleUpdateCollaboratorRole = async (userId: string, role: string) => {
    try {
      const res = await fetch(`/api/albums/${albumId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (res.ok) {
        addNotification("Success", "Collaborator role updated", "success");
        fetchAlbumDetail();
      } else {
        addNotification("Error", data.error || "Failed to update role", "error");
      }
    } catch {
      addNotification("Error", "Failed to update role", "error");
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!window.confirm("Are you sure you want to remove this collaborator?")) return;
    try {
      const res = await fetch(`/api/albums/${albumId}/permissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        addNotification("Success", "Collaborator removed successfully", "success");
        fetchAlbumDetail();
      } else {
        addNotification("Error", data.error || "Failed to remove collaborator", "error");
      }
    } catch {
      addNotification("Error", "Failed to remove collaborator", "error");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSavingSettings(true);
    try {
      const payload: any = {
        name: editName,
        description: editDescription || "",
      };

      if (album?.userId === user?.id) {
        payload.visibility = editVisibility;
        if (editVisibility === "PASSWORD_PROTECTED") {
          payload.password = editPassword || undefined;
        }
      }

      const res = await fetch(`/api/albums/${albumId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        addNotification("Success", "Album settings updated successfully", "success");
        fetchAlbumDetail();
        setShowManageModal(false);
      } else {
        addNotification("Error", data.error || "Failed to update album settings", "error");
      }
    } catch {
      addNotification("Error", "Failed to update settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleGenerateShareLink = async () => {
    setGeneratingShare(true);
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ALBUM",
          albumId,
          durationDays: shareDurationDays,
          downloadPermission: shareDownloadPermission,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addNotification("Success", "Sharing link generated successfully", "success");
        fetchShares();
      } else {
        addNotification("Error", data.error || "Failed to generate share link", "error");
      }
    } catch {
      addNotification("Error", "Failed to generate share link", "error");
    } finally {
      setGeneratingShare(false);
    }
  };

  const handleRevokeShareLink = async (shareId: string) => {
    if (!window.confirm("Are you sure you want to revoke this sharing link? It will stop working immediately.")) return;
    try {
      const res = await fetch("/api/shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      const data = await res.json();
      if (res.ok) {
        addNotification("Success", "Share link revoked", "success");
        fetchShares();
      } else {
        addNotification("Error", data.error || "Failed to revoke share link", "error");
      }
    } catch {
      addNotification("Error", "Failed to revoke share link", "error");
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

  const handleSelectAllPool = () => {
    if (selectedPoolIds.length === globalMediaPool.length) {
      setSelectedPoolIds([]);
    } else {
      setSelectedPoolIds(globalMediaPool.map((item) => item.id));
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

  // Remove files from Album (permanently deletes from database and storage)
  const handleRemoveMedia = async () => {
    if (selectedMediaIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to permanently delete these ${selectedMediaIds.length} items? This will remove them from the database, storage, and gallery. This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/albums/${albumId}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: selectedMediaIds }),
      });

      if (res.ok) {
        addNotification("Success", `Permanently deleted ${selectedMediaIds.length} items`, "success");
        setSelectedMediaIds([]);
        setIsSelectMode(false);
        fetchAlbumDetail();
      }
    } catch {
      addNotification("Error", "Failed to delete items", "error");
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
    if (!window.confirm("Are you sure you want to delete this album? All media files inside will be permanently deleted from everywhere — gallery, other albums, playlists, posts, and chat.")) return;
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

  // Set album cover photo/video
  const handleSetCover = async (mediaId: string) => {
    try {
      const res = await fetch(`/api/albums/${albumId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverMediaId: mediaId }),
      });

      if (res.ok) {
        addNotification("Success", "Album cover updated successfully", "success");
        fetchAlbumDetail();
      } else {
        const data = await res.json();
        addNotification("Error", data.error || "Failed to update album cover", "error");
      }
    } catch {
      addNotification("Error", "Failed to update album cover due to server connection issue", "error");
    }
  };

  if (loading && !verifyingPassword) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs font-bold animate-pulse">
        <Loader2 className="animate-spin text-primary" size={32} />
        LOADING ALBUM DETAILS...
      </div>
    );
  }

  if (passwordRequired) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full filter blur-3xl" />
        <div className="w-full max-w-md glass rounded-3xl p-8 border border-border shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shadow-md mb-4">
              <Lock size={22} className="animate-pulse" />
            </div>
            <h1 className="text-xl font-black text-foreground">Password Protected</h1>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-[280px]">
              This album folder is locked by the host. Enter the secret access password to unlock.
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

  if (!album) return null;

  const isOwner = album.userId === user?.id;
  const canEdit = isOwner || album.permissions.some((p) => p.user.id === user?.id && (p.role === "EDITOR" || p.role === "CONTRIBUTOR"));

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

  const albumMediaItems = sortedJointItems.map((m) => m.media);

  const handleSelectAll = () => {
    if (selectedMediaIds.length === albumMediaItems.length) {
      setSelectedMediaIds([]);
    } else {
      setSelectedMediaIds(albumMediaItems.map((item) => item.id));
    }
  };

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
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {isOwner && !album.isDefault && (
            <button
              onClick={handleDeleteAlbum}
              className="p-2.5 rounded-xl border border-destructive/20 hover:bg-destructive/15 text-destructive cursor-pointer transition-colors shadow-sm"
              title="Delete folder"
            >
              <Trash size={16} />
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => {
                setEditName(album.name);
                setEditDescription(album.description || "");
                setEditVisibility(album.visibility);
                setEditPassword("");
                setManageTab("general");
                setShowManageModal(true);
              }}
              className="flex items-center gap-1.5 border border-border/80 hover:border-primary/45 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-bold px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-xl cursor-pointer hover:shadow transition-all"
              title="Manage settings and collaboration"
            >
              <Settings size={14} />
              <span className="hidden md:inline">Manage Album</span>
            </button>
          )}

          {/* Sorting Dropdown Option */}
          <div className="flex items-center border border-border/60 bg-muted/20 px-3 py-2 rounded-xl shrink-0 gap-1.5 shadow-sm">
            <ArrowUpDown size={13} className="text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer pr-1 border-none focus:ring-0"
            >
              <option value="date" className="bg-card">Sort: Date</option>
              <option value="name" className="bg-card">Sort: Name</option>
              <option value="size" className="bg-card">Sort: Size</option>
              <option value="kind" className="bg-card">Sort: Kind</option>
            </select>
          </div>

          <button
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedMediaIds([]);
            }}
            className={`text-xs font-bold px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
              isSelectMode
                ? "bg-primary/10 border-primary/40 text-primary animate-pulse"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
            title="Selection Mode"
          >
            {isSelectMode ? (
              <>
                <span className="md:hidden">Selected</span>
                <span className="hidden md:inline">Selection Mode</span>
              </>
            ) : (
              <>
                <span className="md:hidden">Select</span>
                <span className="hidden md:inline">Select Items</span>
              </>
            )}
          </button>

          {isSelectMode && albumMediaItems.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 border border-border/60 text-xs font-bold px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-xl text-muted-foreground hover:text-foreground transition-all cursor-pointer bg-muted/20"
            >
              {selectedMediaIds.length === albumMediaItems.length ? (
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

          <button
            onClick={() => setShowCreateSubfolderModal(true)}
            className="flex items-center gap-1.5 border border-border/80 hover:border-primary/45 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-bold px-3 py-2.5 sm:px-4.5 sm:py-2.5 rounded-xl cursor-pointer hover:shadow transition-all"
            title="Create Subfolder"
          >
            <Plus size={14} />
            <span className="hidden md:inline">Subfolder</span>
          </button>

          <button
            onClick={handleOpenAddMedia}
            className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white text-xs font-bold px-3 py-2.5 sm:px-4.5 sm:py-2.5 rounded-xl cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-98"
            title="Add Photos"
          >
            <Plus size={14} />
            <span className="hidden md:inline">Add Photos</span>
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
          {sortedJointItems.map((joint, index) => {
            const item = joint.media;
            const isSelected = selectedMediaIds.includes(item.id);
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
                    const isSelected = selectedMediaIds.includes(item.id);
                    if (isSelected) {
                      swipeModeRef.current = "deselect";
                      setSelectedMediaIds((prev) => prev.filter((id) => id !== item.id));
                    } else {
                      swipeModeRef.current = "select";
                      setSelectedMediaIds((prev) => [...prev, item.id]);
                    }
                  }
                }}
                onMouseEnter={() => {
                  if (isSelectMode && isSwipeSelectingRef.current) {
                    const isSelected = selectedMediaIds.includes(item.id);
                    if (swipeModeRef.current === "select" && !isSelected) {
                      setSelectedMediaIds((prev) => [...prev, item.id]);
                    } else if (swipeModeRef.current === "deselect" && isSelected) {
                      setSelectedMediaIds((prev) => prev.filter((id) => id !== item.id));
                    }
                  }
                }}
                className={`group relative overflow-hidden rounded-2xl cursor-pointer shadow-md transition-all duration-300 border bg-secondary/20 hover:scale-[1.015] hover:shadow-xl ${heightClass} ${
                  isSelected ? "border-primary/80 ring-2 ring-primary/30" : "border-border/60"
                }`}
              >
                {/* Media Image/Video */}
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

                {/* Per-media visibility toggle */}
                {!isSelectMode && (
                  <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-all">
                    {canEdit ? (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const nextVisibility = item.visibility === "PUBLIC" ? "MAKE_PRIVATE" : "MAKE_PUBLIC";
                          try {
                            const res = await fetch("/api/media", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                ids: [item.id],
                                action: nextVisibility
                              }),
                            });
                            if (res.ok) {
                              addNotification("Success", `Media is now ${item.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC"}`, "success");
                              fetchAlbumDetail();
                            } else {
                              const err = await res.json();
                              addNotification("Error", err.error || "Failed to toggle visibility", "error");
                            }
                          } catch {
                            addNotification("Error", "Server connection failed", "error");
                          }
                        }}
                        className="p-1.5 rounded-xl bg-black/60 hover:bg-primary backdrop-blur-md border border-white/10 text-white text-[10px] font-bold flex items-center gap-1 hover:scale-105 transition-all cursor-pointer"
                        title={`Toggle to ${item.visibility === "PUBLIC" ? "Private" : "Public"}`}
                      >
                        {item.visibility === "PUBLIC" ? <Globe size={12} className="text-emerald-400" /> : <Lock size={12} className="text-amber-400" />}
                        <span>{item.visibility}</span>
                      </button>
                    ) : (
                      <div className="p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold flex items-center gap-1">
                        {item.visibility === "PUBLIC" ? <Globe size={12} className="text-emerald-400" /> : <Lock size={12} className="text-amber-400" />}
                        <span>{item.visibility}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cover Photo Badge / Set Cover Button */}
                {album.coverMediaId === item.id ? (
                  <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-xl bg-purple-600/90 backdrop-blur-md border border-purple-400/30 text-white text-[9px] font-extrabold flex items-center gap-1 shadow-md z-10 select-none">
                    <PhotoIcon size={10} /> Cover Photo
                  </div>
                ) : (
                  canEdit && !isSelectMode && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleSetCover(item.id);
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/60 hover:bg-purple-600/90 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold flex items-center gap-1 shadow-md z-10 opacity-0 group-hover:opacity-100 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      title="Set as Album Cover"
                    >
                      <PhotoIcon size={12} />
                      <span className="hidden sm:inline">Set Cover</span>
                    </button>
                  )
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
        <div className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 glass border border-border/80 rounded-2xl shadow-2xl px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between sm:justify-start gap-4 sm:gap-6 z-40 animate-in slide-in-from-bottom-5 duration-300 max-w-[90vw] sm:max-w-md">
          <div className="text-xs font-bold text-foreground sm:border-r sm:border-border sm:pr-5 shrink-0 whitespace-nowrap">
            Selected: <span className="text-primary">{selectedMediaIds.length}</span>
          </div>

          <button
            onClick={handleRemoveMedia}
            className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/25 text-xs font-bold text-rose-500 px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-98 justify-center shrink-0"
            title="Permanently delete selected items from database and storage"
          >
            <Trash2 size={14} /> <span className="hidden sm:inline">Delete Permanently</span><span className="sm:hidden">Delete</span>
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
                          <img src={item.thumbnailUrl || item.url} className="w-full h-full object-cover" />
                        ) : (
                          <video
                            src={`${item.url}#t=0.1`}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
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
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-muted-foreground">
                  Selected: <span className="text-primary">{selectedPoolIds.length} items</span>
                </span>
                {globalMediaPool.length > 0 && (
                  <button
                    onClick={handleSelectAllPool}
                    className="text-[10px] font-extrabold text-primary hover:text-primary/80 transition-colors cursor-pointer uppercase"
                  >
                    {selectedPoolIds.length === globalMediaPool.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

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
          mediaList={albumMediaItems}
          onSelectMedia={(item, index) => setActiveLightboxIndex(index)}
          onClose={() => setActiveLightboxIndex(null)}
          onPrev={activeLightboxIndex > 0 ? handlePrevLightbox : undefined}
          onNext={activeLightboxIndex < albumMediaItems.length - 1 ? handleNextLightbox : undefined}
          onUpdate={fetchAlbumDetail}
        />
      )}

      {/* 9. Album Manage Modal */}
      {showManageModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-lg glass rounded-3xl p-6 border border-border shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                <h2 className="text-base font-black text-foreground">Manage Album Settings</h2>
                <button
                  onClick={() => setShowManageModal(false)}
                  className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex border-b border-border/60 mb-6 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setManageTab("general")}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    manageTab === "general" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  General Settings
                </button>
                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={() => setManageTab("collaborators")}
                      className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        manageTab === "collaborators" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Collaborators ({album.permissions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageTab("shares")}
                      className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                        manageTab === "shares" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Share Links ({sharesList.length})
                    </button>
                  </>
                )}
              </div>

              {/* General Settings Tab */}
              {manageTab === "general" && (
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">
                      Album Title {album.isDefault && "(System Default Album)"}
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={album.isDefault}
                      className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2.5 rounded-xl focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    {album.isDefault && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        The default "Random Media" album cannot be renamed.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2 rounded-xl focus:outline-none resize-none"
                    />
                  </div>

                  {isOwner ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Visibility Mode</label>
                        <select
                          value={editVisibility}
                          onChange={(e) => setEditVisibility(e.target.value)}
                          className="w-full bg-secondary/50 border border-border text-foreground text-xs px-2.5 py-2.5 rounded-xl focus:outline-none"
                        >
                          <option value="PRIVATE">Private Link</option>
                          <option value="PUBLIC">Public Access</option>
                          <option value="PASSWORD_PROTECTED">Password Safe</option>
                        </select>
                      </div>

                      {editVisibility === "PASSWORD_PROTECTED" && (
                        <div>
                          <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">New Password</label>
                          <input
                            type="password"
                            placeholder="Leave blank to keep current"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2.5 rounded-xl focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-secondary/30 border border-border/40 rounded-xl">
                      <span className="text-[9px] font-extrabold text-muted-foreground uppercase block mb-1">Visibility Mode</span>
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {album.visibility === "PUBLIC" ? <Globe size={12} /> : album.visibility === "PASSWORD_PROTECTED" ? <Key size={12} /> : <Lock size={12} />}
                        {album.visibility} (Managed by Owner)
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-4 border-t border-border/40 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowManageModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-foreground font-bold text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-xs shadow hover:shadow-primary/20 cursor-pointer disabled:opacity-50 flex items-center justify-center"
                    >
                      {savingSettings ? <Loader2 className="animate-spin" size={16} /> : "Save Changes"}
                    </button>
                  </div>
                </form>
              )}

              {/* Collaborators Tab */}
              {manageTab === "collaborators" && isOwner && (
                <div className="space-y-6">
                  {/* Invite form */}
                  <form onSubmit={handleAddCollaborator} className="bg-secondary/20 p-4 border border-border/40 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-extrabold text-foreground uppercase tracking-wider">Invite Collaborator</h4>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        required
                        placeholder="Collaborator's email address"
                        value={collabEmail}
                        onChange={(e) => setCollabEmail(e.target.value)}
                        className="flex-1 bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2 rounded-xl focus:outline-none"
                      />
                      <select
                        value={collabRole}
                        onChange={(e) => setCollabRole(e.target.value as any)}
                        className="bg-secondary/50 border border-border text-foreground text-xs px-2.5 py-2 rounded-xl focus:outline-none"
                      >
                        <option value="VIEWER">Viewer</option>
                        <option value="CONTRIBUTOR">Contributor</option>
                        <option value="EDITOR">Editor</option>
                      </select>
                      <button
                        type="submit"
                        disabled={submittingCollab}
                        className="bg-primary hover:bg-primary/95 text-white font-bold text-xs px-4 py-2 rounded-xl shadow cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center"
                      >
                        {submittingCollab ? <Loader2 className="animate-spin" size={14} /> : "Add"}
                      </button>
                    </div>
                  </form>

                  {/* Collaborators list */}
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">Active Collaborators ({album.permissions.length})</h4>
                    {album.permissions.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No collaborators added yet. Add users by email to collaborate!
                      </div>
                    ) : (
                      album.permissions.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3.5 bg-secondary/30 border border-border/45 rounded-xl text-xs gap-3">
                          <div className="truncate">
                            <span className="font-extrabold text-foreground block truncate">
                              {p.user.name || p.user.email}
                            </span>
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {p.user.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={p.role}
                              onChange={(e) => handleUpdateCollaboratorRole(p.user.id, e.target.value)}
                              className="bg-secondary/50 border border-border text-foreground text-[11px] px-2 py-1 rounded-lg focus:outline-none"
                            >
                              <option value="VIEWER">Viewer</option>
                              <option value="CONTRIBUTOR">Contributor</option>
                              <option value="EDITOR">Editor</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveCollaborator(p.user.id)}
                              className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                              title="Remove collaborator"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Share Links Tab */}
              {manageTab === "shares" && isOwner && (
                <div className="space-y-6">
                  {/* Generate share link form */}
                  <div className="bg-secondary/20 p-4 border border-border/40 rounded-2xl space-y-3">
                    <h4 className="text-[10px] font-extrabold text-foreground uppercase tracking-wider">Generate Share Link</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="text-[8px] font-extrabold text-muted-foreground uppercase block mb-1">Expiration</label>
                        <select
                          value={shareDurationDays === null ? "never" : shareDurationDays.toString()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setShareDurationDays(val === "never" ? null : parseInt(val));
                          }}
                          className="w-full bg-secondary/50 border border-border text-foreground text-xs px-2.5 py-2 rounded-xl focus:outline-none"
                        >
                          <option value="never">Never Expires</option>
                          <option value="1">1 Day</option>
                          <option value="7">7 Days</option>
                          <option value="30">30 Days</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <input
                          type="checkbox"
                          id="download_perm"
                          checked={shareDownloadPermission}
                          onChange={(e) => setShareDownloadPermission(e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary/20 h-4 w-4"
                        />
                        <label htmlFor="download_perm" className="text-xs font-semibold text-foreground cursor-pointer select-none">
                          Allow Downloads
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateShareLink}
                        disabled={generatingShare}
                        className="bg-primary hover:bg-primary/95 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {generatingShare ? <Loader2 className="animate-spin" size={14} /> : <Share2 size={13} />}
                        Generate Link
                      </button>
                    </div>
                  </div>

                  {/* Share links list */}
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <h4 className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider font-bold">Active Share Links ({sharesList.length})</h4>
                    {loadingShares ? (
                      <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">
                        Loading share links...
                      </div>
                    ) : sharesList.length === 0 ? (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No share links generated for this album yet.
                      </div>
                    ) : (
                      sharesList.map((share) => {
                        const shareUrl = `${window.location.origin}/share/${share.token}`;
                        const isExpired = share.expiresAt && new Date(share.expiresAt) < new Date();
                        
                        return (
                          <div key={share.id} className="p-3.5 bg-secondary/30 border border-border/45 rounded-xl text-xs space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="truncate flex-1">
                                <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded border border-border/40 select-all block truncate font-bold">
                                  {shareUrl}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(shareUrl);
                                    addNotification("Copied", "Share link copied to clipboard", "success");
                                  }}
                                  className="p-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-foreground cursor-pointer transition-colors"
                                  title="Copy Share Link"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeShareLink(share.id)}
                                  className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                                  title="Revoke Share Link"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground font-semibold">
                              <span>
                                Downloads: {share.downloadPermission ? "Allowed" : "Blocked"}
                              </span>
                              <span>
                                Expires: {share.expiresAt ? new Date(share.expiresAt).toLocaleDateString() : "Never"}
                              </span>
                              {isExpired && (
                                <span className="text-rose-500 font-extrabold uppercase">
                                  Expired
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
