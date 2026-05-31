"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import {
  PlaySquare,
  Plus,
  Play,
  Calendar,
  Layers,
  Loader2,
  ListVideo,
  ChevronRight,
  Clock,
  IterationCw
} from "lucide-react";

interface PlaylistItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  autoPlay: boolean;
  speed: number;
  createdAt: string;
  _count: { items: number };
  items: Array<{
    media: { url: string } | null;
  }>;
}

export default function PlaylistsPage() {
  const { user, addNotification } = useApp();
  
  // Playlists states
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Playlist dialog states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Vacation");
  const [autoPlay, setAutoPlay] = useState(true);
  const [speed, setSpeed] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPlaylists();
    }
  }, [user]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playlists");
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data.playlists);
      }
    } catch {
      addNotification("Error", "Failed to load playlists", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          category: category || null,
          autoPlay,
          speed: Number(speed),
        }),
      });

      if (res.ok) {
        addNotification("Success", `Playlist "${name}" initialized`, "success");
        setName("");
        setDescription("");
        setShowCreateModal(false);
        fetchPlaylists();
      }
    } catch {
      addNotification("Error", "Failed to create playlist", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300 relative min-h-[80vh]">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-black text-foreground">Mixed-Media Playlists</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Build custom timeline presentations of photos and videos with customizable timing transitions.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white font-semibold text-xs px-4.5 py-2.5 rounded-xl cursor-pointer shadow-md hover:shadow-lg transition-all active:scale-98"
        >
          <Plus size={15} /> Create Playlist
        </button>
      </div>

      {/* 2. Listing grid */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs font-bold animate-pulse">
          <Loader2 className="animate-spin text-primary" size={32} />
          LOADING PLAYLISTS CATALOG...
        </div>
      ) : playlists.length === 0 ? (
        <div className="h-96 flex flex-col items-center justify-center text-center p-8 bg-card/10 border-2 border-dashed border-border/60 rounded-3xl">
          <ListVideo size={36} className="text-muted-foreground/60 mb-3" />
          <h3 className="text-base font-extrabold text-foreground mb-1">No playlists created</h3>
          <p className="text-xs text-muted-foreground max-w-[280px]">
            Design customized mixed slideshow workflows with auto-play features.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 border border-border/80 hover:border-primary/45 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-semibold px-4.5 py-2.5 rounded-xl cursor-pointer hover:shadow transition-all"
          >
            Create First Playlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {playlists.map((playlist) => {
            const firstCover = playlist.items[0]?.media;

            return (
              <div
                key={playlist.id}
                className="group flex flex-col justify-between glass rounded-3xl border border-border/60 hover:border-primary/40 hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-xl overflow-hidden h-72"
              >
                {/* Visual card header cover (55% height) */}
                <div className="h-44 w-full relative bg-secondary/40 border-b border-border/40 overflow-hidden">
                  {firstCover ? (
                    <img
                      src={firstCover.url}
                      alt={playlist.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-secondary to-muted/20 text-muted-foreground/80 font-bold group-hover:scale-102 transition-all">
                      <PlaySquare size={36} className="text-muted-foreground/60" />
                    </div>
                  )}

                  {/* Badges indicators overlays */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
                    <span className="text-[9px] font-extrabold bg-black/45 backdrop-blur-md border border-white/10 text-white px-2.5 py-1 rounded-lg">
                      {playlist._count.items} files
                    </span>
                    {playlist.category && (
                      <span className="text-[9px] font-bold bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-lg">
                        {playlist.category}
                      </span>
                    )}
                  </div>

                  {/* Massive overlay floating Play button hover trigger */}
                  <Link
                    href={`/playlists/${playlist.id}`}
                    className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300 z-10 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transform translate-y-3 group-hover:translate-y-0 transition-transform duration-300 hover:scale-105 active:scale-95">
                      <Play size={20} fill="currentColor" className="ml-1" />
                    </div>
                  </Link>
                </div>

                {/* Playlist description details footer (45% height) */}
                <div className="p-5 flex-grow flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="font-extrabold text-sm text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                      {playlist.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {playlist.description || "Custom play queue constructed for visual presentations."}
                    </p>
                  </div>

                  {/* Delay speeds details */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-1 text-[9px] font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={11} className="text-primary" /> {playlist.speed}s slide delay
                    </span>
                    <span className="flex items-center gap-1">
                      <IterationCw size={11} className="text-accent" /> {playlist.autoPlay ? "Autostart ON" : "Manual Click"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. New Playlist dialog popover Form */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass rounded-3xl p-6 border border-border shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-base font-black text-foreground mb-4">Initialize Playlist Builder</h2>
            
            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Playlist Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., Summer Recap 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Record presentation goals..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2 rounded-xl focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Category Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-secondary/50 border border-border text-foreground text-xs px-2.5 py-2.5 rounded-xl focus:outline-none"
                  >
                    <option value="Vacation">Vacation</option>
                    <option value="Family">Family</option>
                    <option value="Events">Events</option>
                    <option value="Showcase">Showcase</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Auto-play Autostart</label>
                  <select
                    value={autoPlay ? "true" : "false"}
                    onChange={(e) => setAutoPlay(e.target.value === "true")}
                    className="w-full bg-secondary/50 border border-border text-foreground text-xs px-2.5 py-2.5 rounded-xl focus:outline-none"
                  >
                    <option value="true">Slideshow Autoplay</option>
                    <option value="false">Manual Navigation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block mb-1">Slides transition delay (seconds)</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full bg-secondary/50 border border-border focus:border-primary/60 text-foreground text-xs px-3 py-2.5 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-border/40 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-foreground font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-xs shadow hover:shadow-primary/20 cursor-pointer disabled:opacity-50 flex items-center justify-center"
                >
                  {submitting ? <Loader2 className="animate-spin" size={16} /> : "Create Playlist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
