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
  Calendar
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
    </div>
  );
}
