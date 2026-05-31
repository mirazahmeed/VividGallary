"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import {
  Image as PhotoIcon,
  Video as VideoIcon,
  FolderHeart,
  PlayCircle,
  CloudLightning,
  History,
  TrendingUp,
  HardDrive
} from "lucide-react";

interface RecentActivity {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, addToUploadQueue, addNotification } = useApp();
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Load user's recent activities
  useEffect(() => {
    if (user) {
      fetchRecentActivity();
    }
  }, [user]);

  const fetchRecentActivity = async () => {
    try {
      // In a regular setup, admins can see all, standard users see their own.
      const res = await fetch("/api/admin/logs");
      if (res.ok) {
        const data = await res.json();
        // Standard user filters logs or system returns user-specific logs
        setActivities(data.logs.slice(0, 5));
      }
    } catch {
      // Ignore background logs failures
    }
  };

  if (!user) return null;

  // Format Storage Quotas
  const storageLimitGB = (user.storageLimit / 1024 / 1024 / 1024).toFixed(1);
  const storageUsedGB = (user.storageUsed / 1024 / 1024 / 1024).toFixed(2);
  const storagePercent = Math.min(100, Math.round((user.storageUsed / user.storageLimit) * 100)) || 0;

  // Math for SVG Circular Progress Gauge
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (storagePercent / 100) * circumference;

  // Drag and Drop files handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await addToUploadQueue(e.dataTransfer.files);
      fetchRecentActivity();
    }
  };

  const formatLogAction = (action: string) => {
    return action.replace(/_/g, " ");
  };

  const formatLogDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - " + d.toLocaleDateString();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* 1. Header Hero Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{user.name || "Media Host"}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Visual host center for your photos, videos, albums, and shared portfolios.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-card/60 border border-border/40 p-2.5 rounded-2xl shadow-sm self-start shrink-0">
          <CloudLightning className="text-primary animate-pulse" size={16} />
          <span className="text-[10px] font-bold text-foreground tracking-wider uppercase">
            Platform Engine Connected
          </span>
        </div>
      </div>

      {/* 2. Top Stats Overview (Storage + Counter widgets) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Radial Storage Ring Card */}
        <div className="glass rounded-3xl p-6 border border-border flex items-center justify-between shadow-lg relative overflow-hidden group">
          <div className="space-y-3.5 relative z-10">
            <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <HardDrive size={13} className="text-primary" /> Storage Allocated
            </span>
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                {storageUsedGB} GB
              </h2>
              <p className="text-[10px] text-muted-foreground font-semibold">
                Consumed out of {storageLimitGB} GB
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              <TrendingUp size={12} /> {100 - storagePercent}% Space Free
            </div>
          </div>

          {/* SVG Progress Circle */}
          <div className="relative flex items-center justify-center shrink-0 w-28 h-28 group-hover:scale-105 transition-transform duration-300">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="56"
                cy="56"
                r={radius}
                className="stroke-secondary fill-transparent"
                strokeWidth="8"
              />
              <circle
                cx="56"
                cy="56"
                r={radius}
                className="stroke-primary fill-transparent transition-all duration-700 ease-out"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-base font-black text-foreground">{storagePercent}%</span>
              <span className="text-[8px] font-bold text-muted-foreground uppercase">Used</span>
            </div>
          </div>
        </div>

        {/* Counter cards (Photos / Videos Ratio) */}
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/gallery?type=IMAGE" className="glass rounded-3xl p-5 border border-border flex flex-col justify-between shadow-lg hover:border-primary/40 hover:-translate-y-1 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PhotoIcon size={20} />
            </div>
            <div className="space-y-0.5 mt-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Photos</span>
              <h3 className="text-xl font-black text-foreground">{user.stats.photosCount}</h3>
            </div>
          </Link>

          <Link href="/gallery?type=VIDEO" className="glass rounded-3xl p-5 border border-border flex flex-col justify-between shadow-lg hover:border-primary/40 hover:-translate-y-1 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <VideoIcon size={20} />
            </div>
            <div className="space-y-0.5 mt-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Videos</span>
              <h3 className="text-xl font-black text-foreground">{user.stats.videosCount}</h3>
            </div>
          </Link>

          <Link href="/albums" className="glass rounded-3xl p-5 border border-border flex flex-col justify-between shadow-lg hover:border-primary/40 hover:-translate-y-1 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FolderHeart size={20} />
            </div>
            <div className="space-y-0.5 mt-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Albums</span>
              <h3 className="text-xl font-black text-foreground">{user.stats.albumsCount}</h3>
            </div>
          </Link>

          <Link href="/playlists" className="glass rounded-3xl p-5 border border-border flex flex-col justify-between shadow-lg hover:border-primary/40 hover:-translate-y-1 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PlayCircle size={20} />
            </div>
            <div className="space-y-0.5 mt-4">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Playlists</span>
              <h3 className="text-xl font-black text-foreground">{user.stats.playlistsCount}</h3>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. Drag & Drop Upload Zone + Activity logs block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Massive Interactive Upload Drag-and-Drop Area */}
        <div className="lg:col-span-2">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`w-full h-80 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-all relative overflow-hidden group shadow-md bg-card/10 ${
              dragActive
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/80 hover:border-primary/50 hover:bg-card/25"
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-secondary/50 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 flex items-center justify-center shadow-inner transition-colors mb-4 relative z-10">
              <CloudLightning size={28} className="group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="text-base font-extrabold text-foreground mb-1.5 relative z-10">
              Drag & Drop your media files here
            </h3>
            <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed relative z-10">
              Supports photos (JPG, PNG, WebP, GIF, HEIC) and video formats (MP4, MOV, WebM, MKV).
            </p>
            <button
              onClick={() => {
                const headerInput = document.querySelector('header input[type="file"]') as HTMLInputElement;
                headerInput?.click();
              }}
              className="mt-6 border border-border/80 hover:border-primary/40 bg-secondary/50 hover:bg-secondary text-foreground text-xs font-semibold px-5 py-2.5 rounded-xl cursor-pointer hover:shadow-md transition-all relative z-10"
            >
              Browse Files
            </button>
            {dragActive && (
              <div className="absolute inset-0 bg-primary/5 backdrop-blur-[2px] transition-all flex items-center justify-center font-bold text-primary text-sm uppercase tracking-widest pointer-events-none">
                DROP MEDIA NOW
              </div>
            )}
          </div>
        </div>

        {/* Activity Audit Feed */}
        <div className="glass rounded-3xl p-6 border border-border shadow-lg flex flex-col">
          <div className="flex items-center gap-2 pb-4 border-b border-border/60 mb-4">
            <History className="text-primary" size={18} />
            <h3 className="font-extrabold text-sm text-foreground">Recent Log Activities</h3>
          </div>

          <div className="flex-1 space-y-4">
            {activities.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center py-12 text-xs text-muted-foreground font-medium">
                No recent activity registered
              </div>
            ) : (
              <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-[1.5px] before:bg-border/60">
                {activities.map((activity) => (
                  <div key={activity.id} className="relative group space-y-0.5">
                    {/* Ring indicator */}
                    <div className="absolute -left-[14.5px] top-1 w-2.5 h-2.5 rounded-full border border-primary bg-background group-hover:bg-primary transition-colors" />
                    
                    <p className="text-[11px] font-bold text-foreground uppercase tracking-wide">
                      {formatLogAction(activity.action)}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      {activity.details || "No details provided"}
                    </p>
                    <span className="text-[9px] text-muted-foreground/60 font-semibold block">
                      {formatLogDate(activity.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
