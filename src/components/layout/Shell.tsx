"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/AppContext";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { Loader2, CloudUpload, CheckCircle2, AlertCircle, X } from "lucide-react";

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, uploadQueue, clearUploadQueue } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Visual Page Loader for initial session check
  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-xs text-muted-foreground font-bold tracking-wider animate-pulse">
          LOADING VIVIDGALLERY...
        </p>
      </div>
    );
  }

  // Active uploads counting
  const activeUploads = uploadQueue.filter((item) => item.status === "uploading" || item.status === "idle");
  const completedUploads = uploadQueue.filter((item) => item.status === "completed");
  const failedUploads = uploadQueue.filter((item) => item.status === "error");
  const hasUploads = uploadQueue.length > 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Backdrop for mobile drawer */}
      <AnimatePresence>
        {user && mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 cursor-pointer"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* 1. Collapsible Sidebar (Only if user logged in) */}
      {user && (
        <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />
      )}

      {/* 2. Scrollable content panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header (Only if user logged in) */}
        {user && <Header onMenuClick={() => setMobileSidebarOpen(true)} />}

        {/* Content body space */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-background/50 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
              className="w-full min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* 3. Floating Upload Status panel (Bottom Right) */}
        <AnimatePresence>
          {user && hasUploads && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 25, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 glass border border-border/85 rounded-2xl shadow-2xl p-4 z-50 flex flex-col max-h-[60vh] overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-border/60 shrink-0">
                <span className="font-bold text-xs flex items-center gap-2 text-foreground">
                  <CloudUpload className="text-primary animate-bounce" size={16} />
                  {activeUploads.length > 0
                    ? `Uploading ${activeUploads.length} item(s)...`
                    : "Uploads Managed"}
                </span>
                <button
                  onClick={clearUploadQueue}
                  className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1 rounded-lg hover:bg-secondary"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-2 divide-y divide-border/40 scrollbar-thin max-h-48 sm:max-h-64">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                    <div className="truncate flex-1">
                      <p className="font-bold text-foreground truncate max-w-[180px] sm:max-w-[220px]">{item.filename}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {(item.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "uploading" && (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-secondary h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-primary">{item.progress}%</span>
                        </div>
                      )}
                      {item.status === "completed" && (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      )}
                      {item.status === "error" && (
                        <AlertCircle size={16} className="text-rose-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Overall totals helper */}
              <div className="mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between font-medium shrink-0">
                <span>Completed: {completedUploads.length}</span>
                {failedUploads.length > 0 && (
                  <span className="text-rose-500 font-bold">Failed: {failedUploads.length}</span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
