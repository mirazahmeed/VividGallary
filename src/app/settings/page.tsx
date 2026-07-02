"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { auth } from "@/lib/firebase";
import { updatePassword, onAuthStateChanged } from "firebase/auth";
import {
  User,
  Settings,
  HardDrive,
  Lock,
  Camera,
  Loader2,
  Check,
  AlertCircle
} from "lucide-react";

export default function SettingsPage() {
  const { user: currentUser, addNotification, refreshUser } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile forms state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [fbUserLoaded, setFbUserLoaded] = useState(false);

  // Load user data on mount / change
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "");
      setBio(currentUser.bio || "");
      setAvatarUrl(currentUser.avatarUrl || "");
      setUsername(currentUser.username || "");
    }
  }, [currentUser]);

  // Sync with Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFbUserLoaded(!!fbUser);
    });
    return () => unsubscribe();
  }, []);

  if (!currentUser) return null;

  // Handle profile metadata updates (name, bio)
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, avatarUrl, username }),
      });

      if (res.ok) {
        addNotification("Success", "Profile details updated successfully", "success");
        await refreshUser();
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to update profile", "error");
      }
    } catch {
      addNotification("Error", "Network request failed", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle avatar upload click
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Process avatar image upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      addNotification("Invalid File", "Only image files are allowed for avatars", "warning");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addNotification("File Too Large", "Avatar image must be under 5MB", "warning");
      return;
    }

    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl);
        addNotification("Avatar Updated", "New profile picture applied successfully", "success");
        await refreshUser();
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to upload avatar", "error");
      }
    } catch {
      addNotification("Error", "Connection failed", "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Update Firebase Auth password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      addNotification("Error", "Passwords do not match", "error");
      return;
    }

    if (newPassword.length < 6) {
      addNotification("Error", "Password must be at least 6 characters long", "error");
      return;
    }

    setSavingPassword(true);
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) {
        addNotification("Error", "Firebase Auth session not ready. Try logging out and back in.", "error");
        return;
      }

      await updatePassword(fbUser, newPassword);
      addNotification("Success", "Password updated in Firebase successfully", "success");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password update error:", err);
      if (err.code === "auth/requires-recent-login") {
        addNotification("Reauthentication Required", "Please log out and log back in to verify your identity.", "warning");
      } else {
        addNotification("Error", err.message || "Failed to update password", "error");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  // Storage Stats math
  const storageLimitGB = (currentUser.storageLimit / 1024 / 1024 / 1024).toFixed(1);
  const storageUsedGB = (currentUser.storageUsed / 1024 / 1024 / 1024).toFixed(2);
  const storageRemainingGB = Math.max(0, (currentUser.storageLimit - currentUser.storageUsed) / 1024 / 1024 / 1024).toFixed(2);
  const storagePercent = Math.min(100, Math.round((currentUser.storageUsed / currentUser.storageLimit) * 100)) || 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-border/60 pb-5">
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Settings className="text-primary animate-spin-slow" size={24} /> Account Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Customize your host profile, configure security credentials, and view storage allocations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Avatar Card & Storage Gauges */}
        <div className="md:col-span-1 space-y-6">
          {/* Avatar Upload Container */}
          <div className="glass rounded-3xl p-6 border border-border/60 text-center flex flex-col items-center gap-4 bg-card/10 shadow-sm relative overflow-hidden">
            <div className="relative group/avatar cursor-pointer" onClick={handleAvatarClick}>
              <div className="w-24 h-24 rounded-full border-2 border-primary/20 bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white text-3xl font-black shadow-lg overflow-hidden relative">
                {uploadingAvatar ? (
                  <Loader2 className="animate-spin text-white" size={24} />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (name || currentUser.email).substring(0, 2).toUpperCase()
                )}

                {/* Edit overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center z-10">
                  <Camera size={20} className="text-white" />
                </div>
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div>
              <h3 className="font-bold text-sm text-foreground truncate max-w-[200px]">{name || "Media Owner"}</h3>
              <p className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5">{currentUser.email}</p>
              <span className="inline-block mt-2 text-[9px] font-black uppercase bg-primary/10 text-primary px-3 py-1 rounded-full">
                {currentUser.role} Account
              </span>
            </div>
          </div>

          {/* Storage usage details */}
          <div className="glass rounded-3xl p-6 border border-border/60 bg-card/10 shadow-sm space-y-4">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b border-border/40 pb-2">
              <HardDrive size={13} className="text-primary" /> Storage Space details
            </h4>

            <div className="space-y-3.5">
              <div className="flex justify-between text-xs font-bold text-foreground">
                <span>{storagePercent}% Used</span>
                <span>{storageUsedGB} GB</span>
              </div>

              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r from-primary to-accent`}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] font-semibold text-muted-foreground">
                <div>
                  <span className="block text-[8px] uppercase">Allocated Limit</span>
                  <span className="text-foreground font-bold">{storageLimitGB} GB</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase">Space Remaining</span>
                  <span className="text-foreground font-bold">{storageRemainingGB} GB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Account and Password forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile metadata form */}
          <div className="glass rounded-3xl p-6 border border-border/60 bg-card/10 shadow-sm">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b border-border/40 pb-3 mb-5">
              <User size={13} className="text-primary" /> Profile Personalization
            </h4>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wide">Display name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-secondary/40 border border-border/80 focus:border-primary/50 text-foreground text-xs px-3 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wide">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  placeholder="e.g. alex_rivera"
                  className="w-full bg-secondary/40 border border-border/80 focus:border-primary/50 text-foreground text-xs px-3 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                  required
                />
                <p className="text-[9px] text-muted-foreground">
                  Your profile URL: <span className="text-primary font-bold">/profile/{username || "username"}</span> (only lowercase letters, numbers, underscores, and dots allowed)
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wide">Bio (Brief description)</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your design aesthetics, albums or visual collections..."
                  className="w-full bg-secondary/40 border border-border/80 focus:border-primary/50 text-foreground text-xs px-3 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all min-h-[100px] font-medium resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full sm:w-auto justify-center bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs px-5 py-3 sm:py-2.5 rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 sm:ml-auto"
              >
                {savingProfile ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                Save profile details
              </button>
            </form>
          </div>

          {/* Firebase password configuration form */}
          <div className="glass rounded-3xl p-6 border border-border/60 bg-card/10 shadow-sm">
            <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 border-b border-border/40 pb-3 mb-5">
              <Lock size={13} className="text-primary" /> Security & Passcode Configuration
            </h4>

            {fbUserLoaded ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wide">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full bg-secondary/25 border border-border/80 focus:border-primary/50 text-foreground text-xs px-3 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wide">Confirm password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full bg-secondary/25 border border-border/80 focus:border-primary/50 text-foreground text-xs px-3 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-secondary/30 border border-border/40 p-3.5 rounded-2xl text-[10px] text-muted-foreground leading-normal">
                  <AlertCircle size={14} className="text-primary shrink-0 mt-0.5" />
                  <span>
                    Sensitive account updates require a secure session. If you have been logged in for a long time, Firebase might ask you to log out and log back in before allowing you to modify your passcode.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full sm:w-auto justify-center bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs px-5 py-3 sm:py-2.5 rounded-xl shadow cursor-pointer transition-all flex items-center gap-1.5 sm:ml-auto"
                >
                  {savingPassword ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  Update secure password
                </button>
              </form>
            ) : (
              <div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse flex items-center justify-center gap-1.5">
                <Loader2 className="animate-spin text-primary" size={16} /> Connecting to Firebase credential directory...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
