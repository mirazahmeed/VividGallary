"use client";

import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import {
  ShieldAlert,
  Users,
  HardDrive,
  Activity,
  UserCog,
  FileCheck,
  TrendingUp,
  Sliders,
  Loader2,
  Trash2,
  Calendar,
  X
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalStorageUsed: number;
  totalMedia: number;
  photosCount: number;
  videosCount: number;
  totalAlbums: number;
  totalPlaylists: number;
  totalShares: number;
}

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  storageLimit: number;
  storageUsed: number;
  createdAt: string;
  _count: { media: number; albums: number };
}

interface LogItem {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

export default function AdminPage() {
  const { user: currentUser, addNotification } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Storage updates modal state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [customLimitGB, setCustomLimitGB] = useState(5);
  const [updatingUser, setUpdatingUser] = useState(false);

  // User media browser states
  const [browsingUser, setBrowsingUser] = useState<UserItem | null>(null);
  const [userMedia, setUserMedia] = useState<any[]>([]);
  const [loadingUserMedia, setLoadingUserMedia] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role === "ADMIN") {
      fetchAdminData();
    }
  }, [currentUser]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
        fetch("/api/admin/logs"),
      ]);

      if (statsRes.ok && usersRes.ok && logsRes.ok) {
        const statsData = await statsRes.json();
        const usersData = await usersRes.json();
        const logsData = await logsRes.json();

        setStats(statsData.stats);
        setUsers(usersData.users);
        setLogs(logsData.logs);
      } else {
        addNotification("Access Denied", "Admin panel is restricted", "error");
      }
    } catch {
      addNotification("Error", "Failed to retrieve administrative diagnostics", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string, updates: { role?: string; storageLimit?: number }) => {
    setUpdatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });

      if (res.ok) {
        addNotification("Success", "User credentials updated successfully", "success");
        setEditingUserId(null);
        fetchAdminData();
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to update user", "error");
      }
    } catch {
      addNotification("Error", "Connection failed", "error");
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user account? This will cascade-delete all their files, albums, and playlists. This action CANNOT be undone!")) return;
    
    setDeletingUserId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        addNotification("Success", "User account permanently deleted", "success");
        fetchAdminData();
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to delete user account", "error");
      }
    } catch {
      addNotification("Error", "Network request failed", "error");
    } finally {
      setDeletingUserId(null);
    }
  };

  const fetchUserMedia = async (user: UserItem) => {
    setBrowsingUser(user);
    setUserMedia([]);
    setLoadingUserMedia(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/media`);
      if (res.ok) {
        const data = await res.json();
        setUserMedia(data.media);
      } else {
        addNotification("Error", "Failed to load user media assets", "error");
      }
    } catch {
      addNotification("Error", "Failed to load user media assets", "error");
    } finally {
      setLoadingUserMedia(false);
    }
  };

  const handleDeleteUserMedia = async (mediaId: string) => {
    if (!browsingUser || !window.confirm("Are you sure you want to permanently delete this media file?")) return;
    
    try {
      const res = await fetch(`/api/admin/users/${browsingUser.id}/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [mediaId] }),
      });

      if (res.ok) {
        addNotification("Success", "Media item permanently deleted", "success");
        setUserMedia((prev) => prev.filter((item) => item.id !== mediaId));
        fetchAdminData();
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to delete media", "error");
      }
    } catch {
      addNotification("Error", "Network connection failed", "error");
    }
  };

  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <div className="h-96 flex items-center justify-center text-xs font-bold text-rose-500 gap-2">
        <ShieldAlert size={20} /> Restricted Page. Administrative Access Required.
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3 text-muted-foreground text-xs font-bold animate-pulse">
        <Loader2 className="animate-spin text-primary" size={32} />
        LOADING SYSTEM METRICS...
      </div>
    );
  }

  const globalStorageUsedGB = (stats.totalStorageUsed / 1024 / 1024 / 1024).toFixed(2);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* 1. Header Hero */}
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <ShieldAlert className="text-primary" size={24} /> Host Administrative Panel
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Perform administrative configurations, manage host accounts quotas, promote user roles, and monitor system activities.
        </p>
      </div>

      {/* 2. Aggregate Diagnostics Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4.5 border border-border/60 shadow-sm space-y-1 bg-card/10">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase flex items-center gap-1.5">
            <HardDrive size={13} className="text-primary" /> Total Storage Used
          </span>
          <h3 className="text-lg font-black text-foreground">{globalStorageUsedGB} GB</h3>
        </div>

        <div className="glass rounded-2xl p-4.5 border border-border/60 shadow-sm space-y-1 bg-card/10">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase flex items-center gap-1.5">
            <Users size={13} className="text-accent" /> Active Accounts
          </span>
          <h3 className="text-lg font-black text-foreground">{stats.totalUsers} hosts</h3>
        </div>

        <div className="glass rounded-2xl p-4.5 border border-border/60 shadow-sm space-y-1 bg-card/10">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase flex items-center gap-1.5">
            <FileCheck size={13} className="text-emerald-500" /> Cataloged Files
          </span>
          <h3 className="text-lg font-black text-foreground">{stats.totalMedia} items</h3>
        </div>

        <div className="glass rounded-2xl p-4.5 border border-border/60 shadow-sm space-y-1 bg-card/10">
          <span className="text-[10px] font-extrabold text-muted-foreground uppercase flex items-center gap-1.5">
            <Sliders size={13} className="text-amber-500" /> Active Shares
          </span>
          <h3 className="text-lg font-black text-foreground">{stats.totalShares} links</h3>
        </div>
      </div>



      {/* 3. Main Split Section: Users Table & Logs feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Quotas Management */}
        <div className="lg:col-span-2 space-y-3 flex flex-col">
          <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
            <UserCog size={13} className="text-primary" /> User Accounts & Quotas allocation
          </span>

          <div className="border border-border/60 rounded-3xl bg-card/10 shadow-sm overflow-hidden flex-grow">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 font-bold text-muted-foreground select-none">
                  <th className="p-4">User Details</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Storage Usage</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((usr) => {
                  const usrUsedGB = (usr.storageUsed / 1024 / 1024 / 1024).toFixed(2);
                  const usrLimitGB = (usr.storageLimit / 1024 / 1024 / 1024).toFixed(1);
                  const usrPercent = Math.round((usr.storageUsed / usr.storageLimit) * 100) || 0;

                  return (
                    <tr key={usr.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-4 font-bold text-foreground">
                        <p>{usr.name || "Media Member"}</p>
                        <span className="text-[10px] text-muted-foreground font-semibold">{usr.email}</span>
                      </td>
                      <td className="p-4 font-bold text-foreground">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                          usr.role === "ADMIN" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          {usr.role}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-foreground">
                        <div className="space-y-1 w-32">
                          <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
                            <span>{usrPercent}%</span>
                            <span>{usrUsedGB} GB</span>
                          </div>
                          <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${usrPercent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right flex items-center justify-end gap-1.5 mt-1 border-none">
                        {/* Adjust Quotas limit */}
                        {editingUserId === usr.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={customLimitGB}
                              onChange={(e) => setCustomLimitGB(Number(e.target.value))}
                              className="w-14 bg-secondary border border-border px-1.5 py-1 rounded text-center text-[10px] focus:outline-none"
                            />
                            <button
                              onClick={() => handleUpdateUser(usr.id, { storageLimit: customLimitGB * 1024 * 1024 * 1024 })}
                              disabled={updatingUser}
                              className="px-2 py-1 bg-primary text-primary-foreground font-bold rounded text-[9px] cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="px-2 py-1 bg-secondary text-foreground font-bold rounded text-[9px] cursor-pointer"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => fetchUserMedia(usr)}
                              className="px-2.5 py-1.5 rounded-lg border border-border/80 hover:bg-secondary text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            >
                              Browse Files
                            </button>

                            <button
                              onClick={() => {
                                setEditingUserId(usr.id);
                                setCustomLimitGB(Math.round(usr.storageLimit / 1024 / 1024 / 1024));
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-border/80 hover:bg-secondary text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            >
                              Limit Quota
                            </button>
                            
                            {/* Toggle role */}
                            <button
                              onClick={() => handleUpdateUser(usr.id, { role: usr.role === "ADMIN" ? "USER" : "ADMIN" })}
                              className="px-2.5 py-1.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-[10px] font-bold text-primary cursor-pointer transition-all"
                            >
                              {usr.role === "ADMIN" ? "Demote Member" : "Promote Admin"}
                            </button>

                            {usr.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteUser(usr.id)}
                                disabled={deletingUserId === usr.id}
                                className="p-1.5 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/15 text-destructive cursor-pointer transition-all flex items-center justify-center shrink-0"
                                title="Delete account permanently"
                              >
                                {deletingUserId === usr.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time System logs */}
        <div className="space-y-3 flex flex-col h-full">
          <span className="text-[10px] font-extrabold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
            <Activity size={13} className="text-accent animate-pulse" /> System Activity Log feed
          </span>

          <div className="glass border border-border/80 rounded-3xl shadow-sm p-4 overflow-y-auto max-h-[480px] flex-grow space-y-4 font-mono scrollbar-thin">
            {logs.length === 0 ? (
              <div className="py-24 text-center text-[10px] font-bold text-muted-foreground">
                No logs registered
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="text-[10px] border-b border-border/30 pb-3 last:border-none space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-primary uppercase">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-normal">{log.details || "Processed successfully"}</p>
                  <span className="text-[9px] text-muted-foreground/50 block font-bold">
                    User: {log.user?.email || "System Daemon"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User Media Browser Modal */}
      {browsingUser && (
        <div className="fixed inset-0 bg-background/85 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[85vh] glass rounded-3xl p-6 border border-border shadow-2xl flex flex-col justify-between animate-in zoom-in-95 duration-200 bg-card/95">
            <div className="flex items-center justify-between pb-4 border-b border-border/60 shrink-0">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  Files Managed: <span className="text-primary">{browsingUser.name || "Media Member"}</span>
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">{browsingUser.email}</p>
              </div>
              <button
                onClick={() => setBrowsingUser(null)}
                className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Media list body */}
            <div className="flex-grow overflow-y-auto py-5 scrollbar-thin">
              {loadingUserMedia ? (
                <div className="h-64 flex flex-col items-center justify-center text-xs font-bold text-muted-foreground animate-pulse gap-2">
                  <Loader2 className="animate-spin text-primary" size={28} /> Loading user catalog...
                </div>
              ) : userMedia.length === 0 ? (
                <div className="py-24 text-center text-xs text-muted-foreground font-semibold">
                  This user has not uploaded any visual assets yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {userMedia.map((item) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square rounded-2xl border border-border/60 overflow-hidden bg-secondary/20 shadow-sm"
                    >
                      {item.type === "IMAGE" ? (
                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full relative">
                          <video
                            src={`${item.url}#t=0.1`}
                            className="w-full h-full object-cover pointer-events-none"
                            muted
                            preload="metadata"
                          />
                          <div className="absolute inset-0 bg-black/15 flex items-center justify-center text-white">
                            <Sliders size={16} />
                          </div>
                        </div>
                      )}

                      {/* Delete icon */}
                      <button
                        onClick={() => handleDeleteUserMedia(item.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-white hover:text-rose-500 cursor-pointer shadow opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete file permanently"
                      >
                        <Trash2 size={12} />
                      </button>

                      {/* Info overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[9px] font-bold text-white truncate leading-none mb-0.5">{item.filename}</p>
                        <span className="text-[8px] text-white/60 font-medium uppercase">{item.visibility} • {(item.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer summary */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-between shrink-0 text-xs">
              <span className="font-bold text-muted-foreground">
                Total Files: <span className="text-primary">{userMedia.length}</span>
              </span>
              <button
                type="button"
                onClick={() => setBrowsingUser(null)}
                className="px-4 py-2 rounded-xl bg-secondary/80 hover:bg-secondary border border-border text-foreground font-bold cursor-pointer"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
