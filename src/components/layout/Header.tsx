"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { 
  Search, 
  Upload, 
  Bell, 
  X, 
  Menu, 
  Check, 
  Trash2, 
  UserPlus, 
  UserCheck, 
  MessageSquare, 
  Heart, 
  Share2, 
  Loader2, 
  Info 
} from "lucide-react";
import UserAvatar from "./UserAvatar";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const {
    user,
    searchQuery,
    setSearchQuery,
    dbNotifications,
    fetchDbNotifications,
    markDbNotificationRead,
    clearAllDbNotifications,
    friendRequests,
    refreshFriendRequests,
    addNotification,
    addToUploadQueue
  } = useApp();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResultsUsers, setSearchResultsUsers] = useState<any[]>([]);
  const [searchResultsPosts, setSearchResultsPosts] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showAllRequestsModal, setShowAllRequestsModal] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Sync local search when global searchQuery changes (e.g. cleared elsewhere)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Perform search when searchQuery changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        performHeaderSearch(searchQuery);
      } else {
        setSearchResultsUsers([]);
        setSearchResultsPosts([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performHeaderSearch = async (query: string) => {
    setSearchLoading(true);
    try {
      const [usersRes, postsRes] = await Promise.all([
        fetch(`/api/users/search?q=${encodeURIComponent(query)}`),
        fetch(`/api/posts?search=${encodeURIComponent(query)}`)
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setSearchResultsUsers(data.users || []);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setSearchResultsPosts(data.posts || []);
      }
    } catch (err) {
      console.error("Header search failed:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  if (!user) return null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addToUploadQueue(e.target.files);
    }
  };

  const handleFriendRequestAction = async (targetUserId: string, action: "accept" | "decline", notifId?: string) => {
    try {
      const res = await fetch(action === "accept" ? "/api/friends" : `/api/friends?userId=${targetUserId}`, {
        method: action === "accept" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: action === "accept" ? JSON.stringify({ targetUserId }) : undefined
      });

      if (res.ok) {
        addNotification(
          action === "accept" ? "Accepted" : "Declined",
          action === "accept" ? "Friend request accepted!" : "Friend request declined.",
          "success"
        );

        // Clear notification from db if it was handled from list
        if (notifId) {
          await fetch(`/api/notifications/${notifId}`, { method: "DELETE" });
        } else {
          // If handled from modal, find matching friend request notification and delete it
          const matchingNotif = dbNotifications.find(n => n.type === "FRIEND_REQUEST" && n.senderId === targetUserId);
          if (matchingNotif) {
            await fetch(`/api/notifications/${matchingNotif.id}`, { method: "DELETE" });
          }
        }

        fetchDbNotifications();
        refreshFriendRequests();
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Action failed", "error");
      }
    } catch {
      addNotification("Error", "Action failed", "error");
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchDbNotifications();
      }
    } catch {
      addNotification("Error", "Failed to delete notification", "error");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "LIKE":
        return <Heart size={16} className="text-rose-500 shrink-0" fill="currentColor" />;
      case "COMMENT":
        return <MessageSquare size={16} className="text-blue-500 shrink-0" />;
      case "SHARE":
        return <Share2 size={16} className="text-amber-500 shrink-0" />;
      case "FRIEND_REQUEST":
        return <UserPlus size={16} className="text-purple-500 shrink-0" />;
      case "FOLLOW":
        return <UserCheck size={16} className="text-emerald-500 shrink-0" />;
      default:
        return <Info size={16} className="text-slate-500 shrink-0" />;
    }
  };

  const unreadCount = dbNotifications.filter(n => !n.isRead).length;

  return (
    <header className="glass-pinned border-b border-border h-16 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Hidden File Input for instant uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/*,video/*"
        className="hidden"
      />

      <div className="flex items-center flex-1 min-w-0 mr-2 sm:mr-4 relative">
        {/* Mobile Hamburger menu */}
        <button
          onClick={onMenuClick}
          className="md:hidden mr-2 p-2.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors active:scale-95"
        >
          <Menu size={20} />
        </button>

        {/* Dynamic Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            placeholder="Search posts, friends..."
            className="w-full bg-secondary/60 hover:bg-secondary/80 focus:bg-secondary border border-border/40 focus:border-primary/50 text-foreground text-xs pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60 font-medium"
          />

          {/* Autocomplete Search Dropdown */}
          {showSearchDropdown && searchQuery.trim() && (
            <div
              ref={searchDropdownRef}
              className="absolute left-0 mt-2 w-[calc(100vw-2.5rem)] sm:w-[28rem] md:w-full rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col z-50 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 p-2 space-y-3"
            >
              {searchLoading && (
                <div className="p-4 text-center text-xs text-muted-foreground font-semibold flex items-center justify-center gap-1.5">
                  <Loader2 className="animate-spin text-primary" size={14} /> Searching posts & friends...
                </div>
              )}

              {!searchLoading && searchResultsUsers.length === 0 && searchResultsPosts.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground font-semibold">
                  No matching posts or profiles found
                </div>
              )}

              {/* Profiles Section */}
              {!searchLoading && searchResultsUsers.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[9px] font-extrabold text-primary uppercase tracking-wider">
                    People / Profiles
                  </div>
                  {searchResultsUsers.slice(0, 5).map((u) => (
                    <Link
                      key={u.id}
                      href={`/profile/${u.username || u.id}`}
                      onClick={() => setShowSearchDropdown(false)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/60 transition-colors text-left"
                    >
                      <UserAvatar
                        avatarUrl={u.avatarUrl}
                        name={u.name}
                        email={u.email}
                        className="w-8 h-8 rounded-full font-bold text-xs"
                      />
                      <div className="truncate flex-1">
                        <p className="text-xs font-bold text-foreground truncate">{u.name || "Anonymous User"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Posts Section */}
              {!searchLoading && searchResultsPosts.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[9px] font-extrabold text-primary uppercase tracking-wider">
                    Timeline Posts
                  </div>
                  {searchResultsPosts.slice(0, 5).map((p) => (
                    <Link
                      key={p.id}
                      href={`/profile/${p.user.username || p.user.id}`}
                      onClick={() => setShowSearchDropdown(false)}
                      className="flex flex-col p-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left border border-border/20 bg-secondary/15"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <UserAvatar
                          avatarUrl={p.user.avatarUrl}
                          name={p.user.name}
                          email={p.user.email}
                          className="w-5 h-5 rounded-full font-bold text-[8px]"
                        />
                        <span className="text-[10px] font-bold text-foreground">{p.user.name || "Anonymous"}</span>
                        <span className="text-[8px] text-muted-foreground ml-auto">{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate w-full pl-7">
                        {p.content || (p.media ? "📎 Attached file" : "")}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Upload Trigger */}
        <button
          onClick={handleUploadClick}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-accent hover:from-primary/95 hover:to-accent/95 text-white font-semibold text-xs p-3 sm:px-4.5 sm:py-2.5 rounded-xl cursor-pointer shadow-md hover:shadow-lg hover:shadow-primary/10 active:scale-95 transition-all"
          title="Upload Media"
        >
          <Upload size={16} />
          <span className="hidden sm:inline">Upload Media</span>
        </button>

        {/* Notifications Icon and dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              // Mark all as read when opening notifications dropdown
              if (!showNotifications && unreadCount > 0) {
                fetch("/api/notifications", { method: "PUT" }).then(() => fetchDbNotifications());
              }
            }}
            className="p-3 rounded-xl hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer relative active:scale-95"
          >
            <Bell size={20} />
            {(unreadCount > 0 || friendRequests.length > 0) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="fixed sm:absolute right-4 sm:right-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 max-h-[30rem] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <span className="font-bold text-sm">Notifications</span>
                <div className="flex gap-2">
                  {dbNotifications.length > 0 && (
                    <button
                      onClick={() => clearAllDbNotifications()}
                      className="text-[10px] text-muted-foreground hover:text-foreground font-bold cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                    {unreadCount} New
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {dbNotifications.length === 0 && friendRequests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground font-medium">
                    No recent notifications
                  </div>
                ) : (
                  <>
                    {/* Render friend requests at the top */}
                    {friendRequests.map((req) => (
                      <div key={`req-${req.id}`} className="p-4 flex gap-3 bg-primary/5 hover:bg-primary/10 transition-colors relative group">
                        <UserPlus size={16} className="text-purple-500 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-2">
                          <div>
                            <p className="text-xs font-bold text-foreground leading-tight">Friend Request</p>
                            <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                              <span className="font-bold text-foreground">{req.name || req.email}</span> sent you a friend request.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleFriendRequestAction(req.id, "accept")}
                              className="bg-primary hover:bg-primary/90 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 shadow-sm transition-all"
                            >
                              <Check size={12} /> Accept
                            </button>
                            <button
                              onClick={() => handleFriendRequestAction(req.id, "decline")}
                              className="bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Render standard notifications */}
                    {dbNotifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        onClick={() => markDbNotificationRead(notif.id)}
                        className={`p-4 flex gap-3 hover:bg-secondary/30 transition-colors relative group cursor-pointer ${!notif.isRead ? "bg-secondary/15" : ""}`}
                      >
                        {getNotificationIcon(notif.type)}
                        <div className="space-y-0.5 pr-6 flex-1">
                          <p className="text-xs font-bold text-foreground leading-tight">
                            {notif.sender?.name || notif.sender?.email || "System"}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-normal">{notif.content}</p>
                          <span className="text-[8px] text-muted-foreground/60 font-semibold block pt-0.5">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(notif.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteNotification(e, notif.id)}
                          className="absolute right-2 top-2 p-1 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {friendRequests.length > 0 && (
                <div className="p-3 bg-muted/20 border-t border-border text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      setShowAllRequestsModal(true);
                    }}
                    className="text-xs text-primary hover:text-primary/95 font-bold cursor-pointer transition-colors"
                  >
                    See All Friend Requests ({friendRequests.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Info Capsule */}
        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-border">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-foreground">{user.name || "Media Owner"}</p>
            <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 mt-0.5 inline-block">
              {user.role}
            </span>
          </div>
          <Link href={`/profile/${user.username || user.id}`} title="View my profile">
            <UserAvatar
              avatarUrl={user.avatarUrl}
              name={user.name}
              email={user.email}
              className="w-9 h-9 rounded-xl font-bold text-sm shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            />
          </Link>
        </div>
      </div>

      {/* See All Friend Requests Modal */}
      {showAllRequestsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-black text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <UserPlus size={18} className="text-primary" /> Pending Friend Requests
              </h3>
              
              <button
                onClick={() => setShowAllRequestsModal(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-4 space-y-3">
              {friendRequests.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No pending friend requests.
                </p>
              ) : (
                friendRequests.map((req) => (
                  <div
                    key={`modal-req-${req.id}`}
                    className="flex items-center justify-between p-3 rounded-2xl border border-border/50 bg-secondary/10"
                  >
                    <div className="flex items-center gap-3 min-w-0 mr-3">
                      <UserAvatar
                        avatarUrl={req.avatarUrl}
                        name={req.name}
                        email={req.email}
                        className="w-9 h-9 rounded-full font-bold text-xs shrink-0"
                      />
                      <div className="truncate">
                        <p className="text-xs font-bold text-foreground truncate">{req.name || "Anonymous"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{req.email}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleFriendRequestAction(req.id, "accept")}
                        className="bg-primary hover:bg-primary/95 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleFriendRequestAction(req.id, "decline")}
                        className="bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
