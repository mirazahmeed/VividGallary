"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import {
  FolderOpen,
  Plus,
  Lock,
  Globe,
  Key,
  Users,
  Loader2,
  FolderHeart,
  ChevronRight
} from "lucide-react";

interface AlbumItem {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  coverMedia: { url: string } | null;
  parentId: string | null;
  _count: { media: number };
  user: { name: string | null; email: string };
  userId: string;
}

export default function AlbumsPage() {
  const { user, addNotification } = useApp();
  
  // Albums list states
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Album dialog states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("PRIVATE");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAlbums();
    }
  }, [user]);

  const fetchAlbums = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/albums");
      if (res.ok) {
        const data = await res.json();
        // Hide child nested sub-albums from the root listing to keep it clean and organized (they are accessed inside parent!)
        const rootOnlyAlbums = data.albums.filter((a: AlbumItem) => !a.parentId);
        setAlbums(rootOnlyAlbums);
      }
    } catch {
      addNotification("Error", "Failed to load albums", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          visibility,
          password: password || null,
        }),
      });

      if (res.ok) {
        addNotification("Success", `Album "${name}" created successfully`, "success");
        setName("");
        setDescription("");
        setVisibility("PRIVATE");
        setPassword("");
        setShowCreateModal(false);
        fetchAlbums();
      }
    } catch {
      addNotification("Error", "Failed to create album", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getVisibilityIcon = (mode: string) => {
    switch (mode) {
      case "PUBLIC":
        return <span title="Public access"><Globe size={13} className="text-emerald-500" /></span>;
      case "PASSWORD_PROTECTED":
        return <span title="Password challenge"><Key size={13} className="text-amber-500" /></span>;
      case "INVITE_ONLY":
        return <span title="Invite collaboration"><Users size={13} className="text-purple-500" /></span>;
      default:
        return <span title="Private folder"><Lock size={13} className="text-muted-foreground/80" /></span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 relative min-h-[80vh]">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-black text-foreground">Media Albums</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Group, catalog, and share photos or videos inside smart collaborative folders.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white font-semibold text-xs px-4.5 py-2.5 rounded-xl cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-98"
        >
          <Plus size={15} /> New Album
        </button>
      </div>

      {/* 2. Grid listing of root albums */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs font-bold animate-pulse">
          <Loader2 className="animate-spin text-primary" size={32} />
          LOADING ALBUMS COLLECTIONS...
        </div>
      ) : albums.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-card/10 border-2 border-dashed border-border/60 rounded-3xl">
          <FolderHeart size={36} className="text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-extrabold text-foreground mb-1">No albums found</h3>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            Organize your visual gallery by initializing your first folder album now.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 border border-border/80 hover:border-primary/45 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold px-4.5 py-2.5 rounded-xl cursor-pointer hover:shadow-md transition-all"
          >
            Create First Album
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {albums.map((album) => {
            const isCollab = album.userId !== user?.id;

            return (
              <Link
                key={album.id}
                href={`/albums/${album.id}`}
                className="group flex flex-col justify-between glass rounded-3xl border border-border/60 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-xl overflow-hidden h-72"
              >
                {/* Album Cover Graphic card (55% height) */}
                <div className="h-44 w-full relative bg-secondary/40 border-b border-border/40 overflow-hidden">
                  {album.coverMedia ? (
                    <img
                      src={album.coverMedia.url}
                      alt={album.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-secondary to-muted/20 text-muted-foreground/80 font-bold group-hover:scale-102 transition-all">
                      <FolderOpen size={36} className="text-muted-foreground/60" />
                    </div>
                  )}

                  {/* Quantity and visibility tags overlay */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
                    <span className="text-[9px] font-extrabold bg-black/45 backdrop-blur-md border border-white/10 text-white px-2.5 py-1 rounded-lg">
                      {album._count.media} items
                    </span>
                    <div className="p-1.5 rounded-lg bg-black/45 backdrop-blur-md border border-white/10">
                      {getVisibilityIcon(album.visibility)}
                    </div>
                  </div>

                  {/* Collab shared badge */}
                  {isCollab && (
                    <div className="absolute bottom-3 left-3 bg-purple-500 text-white text-[8px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Shared Collab
                    </div>
                  )}
                </div>

                {/* Album Title Details (45% height) */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                      {album.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {album.description || "No description cataloged for this media folder."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-1">
                    <span className="text-[9px] text-muted-foreground/80 font-semibold truncate max-w-[120px]">
                      By: {isCollab ? album.user.name || album.user.email : "You"}
                    </span>
                    <span className="text-[9px] text-primary font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">
                      Open Folder <ChevronRight size={10} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 3. New Album Modal overlay Popover */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass rounded-3xl p-6 border border-border shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-black text-foreground mb-4">Initialize Media Album</h2>
            
            <form onSubmit={handleCreateAlbum} className="space-y-4">
              <div>
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Album Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Summer Travels 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Record summary details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2 rounded-xl focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Visibility Mode</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="w-full bg-secondary/50 border border-border text-foreground text-xs px-2.5 py-2.5 rounded-xl focus:outline-none"
                  >
                    <option value="PRIVATE">Private Link</option>
                    <option value="PUBLIC">Public Access</option>
                    <option value="PASSWORD_PROTECTED">Password Safe</option>
                  </select>
                </div>

                {visibility === "PASSWORD_PROTECTED" && (
                  <div>
                    <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Secure Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Access token code"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2.5 rounded-xl focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Action indicators */}
              <div className="flex gap-3 pt-3 border-t border-border/40 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-foreground font-bold text-xs cursor-pointer hover:shadow"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-xs shadow hover:shadow-primary/20 cursor-pointer disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : "Create Album"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
