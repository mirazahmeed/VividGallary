"use client";

import React, { useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Search, Upload, Bell, CheckCircle, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export default function Header() {
  const {
    user,
    searchQuery,
    setSearchQuery,
    notifications,
    clearNotification,
    addToUploadQueue
  } = useApp();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addToUploadQueue(e.target.files);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle size={16} className="text-emerald-500 shrink-0" />;
      case "warning":
        return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
      case "error":
        return <AlertCircle size={16} className="text-rose-500 shrink-0" />;
      default:
        return <Info size={16} className="text-blue-500 shrink-0" />;
    }
  };

  return (
    <header className="glass border-b border-border h-16 px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Hidden File Input for instant uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*,video/*"
        className="hidden"
      />

      {/* Dynamic Search Bar */}
      <div className="relative w-96 max-w-lg">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by filename, tags..."
          className="w-full bg-secondary/60 hover:bg-secondary/80 focus:bg-secondary border border-border/40 focus:border-primary/50 text-foreground text-sm pl-11 pr-4 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-4">
        {/* Upload Trigger */}
        <button
          onClick={handleUploadClick}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white font-semibold text-xs px-4.5 py-2.5 rounded-xl cursor-pointer shadow-md hover:shadow-lg hover:shadow-primary/10 active:scale-98 transition-all"
        >
          <Upload size={15} /> Upload Media
        </button>

        {/* Notifications Icon and dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2.5 rounded-xl hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer relative"
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 max-h-96 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <span className="font-bold text-sm">Notifications</span>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  {notifications.length} New
                </span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                    No recent notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-4 flex gap-3 hover:bg-secondary/30 transition-colors relative group">
                      {getNotificationIcon(notif.type)}
                      <div className="space-y-0.5 pr-4">
                        <p className="text-xs font-bold text-foreground leading-tight">{notif.title}</p>
                        <p className="text-[11px] text-muted-foreground leading-normal">{notif.message}</p>
                      </div>
                      <button
                        onClick={() => clearNotification(notif.id)}
                        className="absolute right-2 top-2 p-1 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info Capsule */}
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-foreground">{user.name || "Media Owner"}</p>
            <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 mt-0.5 inline-block">
              {user.role}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-bold text-sm shadow-md">
            {(user.name || user.email).substring(0, 2).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
}
