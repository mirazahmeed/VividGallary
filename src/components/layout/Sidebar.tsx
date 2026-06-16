"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext";
import {
  Image as GalleryIcon,
  FolderOpen,
  PlaySquare,
  ShieldAlert,
  HardDrive,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LayoutDashboard,
  Compass,
  UserCheck,
  Settings,
  X,
  MessageSquare,
  User
} from "lucide-react";

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const { user, theme, toggleTheme, logout, unreadChatCount } = useApp();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Explore", href: "/explore", icon: Compass },
    { name: "Following", href: "/following", icon: UserCheck },
    { name: "Gallery", href: "/gallery", icon: GalleryIcon },
    { name: "Albums", href: "/albums", icon: FolderOpen },
    { name: "Playlists", href: "/playlists", icon: PlaySquare },
    { name: "Chat", href: "/chat", icon: MessageSquare },
    { name: "Profile", href: `/profile/${user.username || user.id}`, icon: User },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // If user is Admin, render the Admin Control panel route
  if (user.role === "ADMIN") {
    menuItems.push({ name: "Admin Panel", href: "/admin", icon: ShieldAlert });
  }

  // Calculate storage percentage
  const storagePercent = Math.min(100, Math.round((user.storageUsed / user.storageLimit) * 100)) || 0;
  const storageLimitGB = (user.storageLimit / 1024 / 1024 / 1024).toFixed(1);
  const storageUsedGB = (user.storageUsed / 1024 / 1024 / 1024).toFixed(2);

  const isCollapsedVisual = collapsed && !mobileOpen;

  return (
    <aside
      className={`glass border-r border-border h-screen flex flex-col justify-between transition-all duration-300 fixed md:relative z-40 md:z-20 ${
        isCollapsedVisual ? "w-20" : "w-64"
      } ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Collapse Toggle Trigger */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-primary text-primary-foreground rounded-full hidden md:flex items-center justify-center cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-transform z-50"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Top Header Logo */}
      <div className="p-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-bold text-lg shadow-lg shrink-0">
            V
          </div>
          {!isCollapsedVisual && (
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent text-lg tracking-wide">
              VividGallery
            </span>
          )}
        </div>
        {/* Close Button on mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon size={20} className={isActive ? "" : "group-hover:text-primary transition-colors"} />
              {!isCollapsedVisual && <span className="font-medium text-sm">{item.name}</span>}
              {!isCollapsedVisual && item.name === "Chat" && unreadChatCount > 0 && (
                <span className="ml-auto bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 shadow-md animate-pulse">
                  {unreadChatCount}
                </span>
              )}
              {isCollapsedVisual && item.name === "Chat" && unreadChatCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {unreadChatCount}
                </span>
              )}
              {isCollapsedVisual && (
                <div className="absolute left-16 bg-card border border-border text-foreground text-xs py-1.5 px-3 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile, Storage & Theme controls */}
      <div className="p-4 border-t border-border space-y-4">
        {/* Storage usage details */}
        <div className={`rounded-xl p-3 bg-muted/40 border border-border/40 ${isCollapsedVisual ? "flex justify-center" : ""}`}>
          {isCollapsedVisual ? (
            <div className="group relative cursor-pointer">
              <HardDrive size={20} className={storagePercent > 90 ? "text-destructive" : "text-primary"} />
              <div className="absolute left-12 bottom-0 bg-card border border-border text-foreground text-xs p-3 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl whitespace-nowrap z-50">
                <p className="font-bold">Storage Limit</p>
                <p className="text-muted-foreground">{storagePercent}% used ({storageUsedGB} GB / {storageLimitGB} GB)</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <HardDrive size={14} className="text-primary" /> Storage
                </span>
                <span className={storagePercent > 90 ? "text-destructive" : "text-primary"}>
                  {storagePercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    storagePercent > 90
                      ? "bg-destructive"
                      : "bg-gradient-to-r from-primary to-accent"
                  }`}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">
                {storageUsedGB} GB used of {storageLimitGB} GB
              </p>
            </div>
          )}
        </div>

        {/* Theme and Logout toggles */}
        <div className="flex flex-col gap-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full text-left"
          >
            {theme === "dark" ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
            {!isCollapsedVisual && <span className="text-sm font-medium">Theme Mode</span>}
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer w-full text-left"
          >
            <LogOut size={20} className="text-destructive/80" />
            {!isCollapsedVisual && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
