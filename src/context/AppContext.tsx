"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

// Types
export interface UserStats {
  mediaCount: number;
  photosCount: number;
  videosCount: number;
  albumsCount: number;
  playlistsCount: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl: string | null;
  bio: string | null;
  storageLimit: number;
  storageUsed: number;
  stats: UserStats;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  createdAt: Date;
}

export interface UploadQueueItem {
  id: string;
  filename: string;
  progress: number;
  status: "idle" | "uploading" | "completed" | "error";
  size: number;
}

interface AppContextType {
  user: UserProfile | null;
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  notifications: Notification[];
  addNotification: (title: string, message: string, type?: Notification["type"]) => void;
  clearNotification: (id: string) => void;
  uploadQueue: UploadQueueItem[];
  addToUploadQueue: (files: FileList) => Promise<void>;
  clearUploadQueue: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const router = useRouter();
  const pathname = usePathname();

  // Load User and Theme on Mount
  useEffect(() => {
    refreshUser();
    const savedTheme = localStorage.getItem("vivid-theme") as "dark" | "light";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.className = savedTheme === "light" ? "light-theme" : "";
    }
  }, []);

  // Sync user access restrictions
  useEffect(() => {
    const publicRoutes = ["/login", "/register", "/share"];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    if (!loading && !user && !isPublicRoute) {
      router.push("/login");
    }
  }, [user, loading, pathname]);

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
      addNotification("Logged Out", "You have successfully logged out", "info");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("vivid-theme", nextTheme);
    document.documentElement.className = nextTheme === "light" ? "light-theme" : "";
    addNotification("Theme Switched", `Switched to ${nextTheme} mode`, "info");
  };

  const addNotification = (title: string, message: string, type: Notification["type"] = "info") => {
    const newNotif: Notification = {
      id: Math.random().toString(),
      title,
      message,
      type,
      createdAt: new Date(),
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 19)]);
    
    // Auto clear notification after 5 seconds
    setTimeout(() => {
      clearNotification(newNotif.id);
    }, 5000);
  };

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const addToUploadQueue = async (files: FileList) => {
    const newItems: UploadQueueItem[] = Array.from(files).map((file) => ({
      id: Math.random().toString(),
      filename: file.name,
      progress: 0,
      status: "idle",
      size: file.size,
    }));

    setUploadQueue((prev) => [...prev, ...newItems]);
    
    // Start upload pipeline in parallel batches
    const fd = new FormData();
    Array.from(files).forEach((file) => {
      fd.append("files", file);
    });

    // Detect if we're inside an active album detail view to auto-associate uploads
    const isAlbumView = pathname.startsWith("/albums/");
    if (isAlbumView) {
      const albumId = pathname.split("/").pop();
      if (albumId && albumId !== "albums") {
        fd.append("albumId", albumId);
      }
    }

    // Set first batch as uploading
    setUploadQueue((prev) =>
      prev.map((item) =>
        newItems.some((n) => n.filename === item.filename)
          ? { ...item, status: "uploading", progress: 20 }
          : item
      )
    );

    try {
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        const data = await res.json();
        
        // Mark items as completed
        setUploadQueue((prev) =>
          prev.map((item) =>
            newItems.some((n) => n.filename === item.filename)
              ? { ...item, status: "completed", progress: 100 }
              : item
          )
        );

        addNotification(
          "Upload Complete",
          `Successfully uploaded ${files.length} items`,
          "success"
        );

        // Refresh user quotas and trigger gallery sync
        refreshUser();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
    } catch (err: any) {
      setUploadQueue((prev) =>
        prev.map((item) =>
          newItems.some((n) => n.filename === item.filename)
            ? { ...item, status: "error", progress: 0 }
            : item
        )
      );

      addNotification("Upload Failed", err.message || "Failed to process files", "error");
    }
  };

  const clearUploadQueue = () => {
    setUploadQueue([]);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        searchQuery,
        setSearchQuery,
        notifications,
        addNotification,
        clearNotification,
        uploadQueue,
        addToUploadQueue,
        clearUploadQueue,
        theme,
        toggleTheme,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
