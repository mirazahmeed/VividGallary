"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import UserAvatar from "@/components/layout/UserAvatar";
import Lightbox, { MediaItem } from "@/components/gallery/Lightbox";
import {
  MessageSquare,
  Send,
  Search,
  Image as ImageIcon,
  X,
  Loader2,
  Paperclip,
  User,
  FolderOpen,
  Video,
  ArrowLeft
} from "lucide-react";

interface ChatUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  bio?: string | null;
}

interface ChatMessage {
  id: string;
  content: string | null;
  createdAt: string;
  senderId: string;
  receiverId: string;
  sender: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  receiver: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  media: {
    id: string;
    filename: string;
    type: "IMAGE" | "VIDEO";
    url: string;
    thumbnailUrl: string | null;
    size: number;
    mimeType: string;
    width: number | null;
    height: number | null;
    duration: number | null;
  } | null;
}

interface Conversation {
  user: ChatUser;
  lastMessage: {
    id: string;
    content: string | null;
    createdAt: string;
    senderId: string;
    receiverId: string;
    media: any | null;
  };
  unreadCount?: number;
}

export default function ChatPage() {
  const { user: currentUser, addNotification } = useApp();
  
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Media Attachment Picker State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [userMedia, setUserMedia] = useState<any[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");
  
  // Lightbox view state
  const [activeLightboxMedia, setActiveLightboxMedia] = useState<MediaItem | null>(null);

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load conversations list on mount & periodic polling
  useEffect(() => {
    fetchConversations();
    
    pollingIntervalRef.current = setInterval(() => {
      fetchConversations(true); // silent fetch in background
    }, 6000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  // Sync conversation polling for messages if user is selected
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }

    fetchMessages(selectedUser.id);
    
    // Poll messages every 4 seconds when chatting
    const msgInterval = setInterval(() => {
      fetchMessages(selectedUser.id, true);
    }, 4000);

    return () => clearInterval(msgInterval);
  }, [selectedUser?.id]);

  // Scroll to bottom on messages load/update
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Trigger search when search query changes
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Fetch active conversation list
  const fetchConversations = async (silent = false) => {
    if (!silent) setConversationsLoading(true);
    try {
      const res = await fetch("/api/chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error("Conversations list fetch failed:", err);
    } finally {
      if (!silent) setConversationsLoading(false);
    }
  };

  // Fetch chat thread with specified user
  const fetchMessages = async (userId: string, silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      const res = await fetch(`/api/chat/messages?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error("Messages list fetch failed:", err);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  };

  // Search user directory
  const searchUsers = async (query: string) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (err) {
      console.error("Search users error:", err);
    } finally {
      setSearching(false);
    }
  };

  // Send textual message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !inputText.trim()) return;

    const body = {
      receiverId: selectedUser.id,
      content: inputText.trim()
    };

    setInputText("");
    setSendingMessage(true);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        fetchConversations(true);
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to send message", "error");
      }
    } catch {
      addNotification("Error", "Network error. Failed to send.", "error");
    } finally {
      setSendingMessage(false);
    }
  };

  // Attach & send media item directly
  const handleSendMediaAttachment = async (mediaId: string) => {
    if (!selectedUser) return;
    setIsMediaPickerOpen(false);
    setSendingMessage(true);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: selectedUser.id,
          mediaId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        fetchConversations(true);
        addNotification("Sent", "Media shared in conversation", "success");
      } else {
        const err = await res.json();
        addNotification("Error", err.error || "Failed to send media", "error");
      }
    } catch {
      addNotification("Error", "Network error. Failed to send media.", "error");
    } finally {
      setSendingMessage(false);
    }
  };

  // Load user's personal media files for picker
  const openMediaPicker = async () => {
    setIsMediaPickerOpen(true);
    setMediaLoading(true);
    try {
      const res = await fetch("/api/media");
      if (res.ok) {
        const data = await res.json();
        setUserMedia(data.media || []);
      }
    } catch {
      addNotification("Error", "Could not fetch media list", "error");
    } finally {
      setMediaLoading(false);
    }
  };

  // Filter media in modal list
  const filteredMedia = userMedia.filter((item) =>
    item.filename.toLowerCase().includes(mediaSearchQuery.toLowerCase())
  );

  // Trigger full lightbox display from message click
  const openLightboxForMedia = (mediaObj: any) => {
    const item: MediaItem = {
      id: mediaObj.id,
      filename: mediaObj.filename,
      type: mediaObj.type,
      url: mediaObj.url,
      thumbnailUrl: mediaObj.thumbnailUrl,
      size: mediaObj.size,
      mimeType: mediaObj.mimeType,
      width: mediaObj.width,
      height: mediaObj.height,
      duration: mediaObj.duration,
      resolution: null,
      isFavorite: false,
      isArchived: false,
      metadata: null,
      createdAt: new Date().toISOString(),
      tags: [],
      comments: [],
      likes: []
    };
    setActiveLightboxMedia(item);
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] rounded-3xl border border-border/60 bg-card/10 glass shadow-xl overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. Left Sidebar: Contacts & User Search */}
      <div className={`w-full md:w-80 flex flex-col border-r border-border/60 ${selectedUser ? "hidden md:flex" : "flex"}`}>
        
        {/* Search header bar */}
        <div className="p-4 border-b border-border/50 space-y-3 shrink-0">
          <h2 className="text-base font-black text-foreground flex items-center gap-1.5">
            <MessageSquare size={18} className="text-primary" /> Direct Chats
          </h2>
          <div className="relative">
            <input
              type="text"
              placeholder="Search users to chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-secondary/40 border border-border/80 focus:border-primary/50 text-foreground text-xs pl-8 pr-8 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
            />
            <Search className="absolute left-2.5 top-3 text-muted-foreground" size={14} />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-3 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Directory results OR active conversations list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {searchQuery ? (
            // Search directory results
            <div className="space-y-1">
              <div className="px-2 py-1 text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">
                Directory Search
              </div>
              {searching ? (
                <div className="p-4 text-center text-xs font-semibold text-muted-foreground flex justify-center items-center gap-1.5">
                  <Loader2 className="animate-spin text-primary" size={14} /> Searching user base...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground font-semibold">
                  No users found matching query
                </div>
              ) : (
                searchResults.map((searchUser) => (
                  <button
                    key={searchUser.id}
                    onClick={() => {
                      setSelectedUser(searchUser);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-primary/10 transition-colors text-left group"
                  >
                    <UserAvatar
                      avatarUrl={searchUser.avatarUrl}
                      name={searchUser.name}
                      email={searchUser.email}
                      className="w-9 h-9 rounded-full font-bold text-xs"
                    />
                    <div className="truncate flex-1">
                      <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                        {searchUser.name || "Media Owner"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{searchUser.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            // Active chats feed
            <div className="space-y-1">
              <div className="px-2 py-1 text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider">
                Active Discussions
              </div>
              {conversationsLoading && conversations.length === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-muted-foreground flex flex-col justify-center items-center gap-2">
                  <Loader2 className="animate-spin text-primary" size={16} /> Retrieving chat threads...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground leading-relaxed">
                  No conversations started yet. Use search above to look up profiles and say hi!
                </div>
              ) : (
                conversations.map((convo) => {
                  const isSelected = selectedUser?.id === convo.user.id;
                  const isOutbound = convo.lastMessage.senderId === currentUser?.id;
                  
                  return (
                    <button
                      key={convo.user.id}
                      onClick={() => {
                        setSelectedUser(convo.user);
                        setConversations(prev =>
                          prev.map(c => c.user.id === convo.user.id ? { ...c, unreadCount: 0 } : c)
                        );
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 text-left ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <UserAvatar
                        avatarUrl={convo.user.avatarUrl}
                        name={convo.user.name}
                        email={convo.user.email}
                        className={`w-10 h-10 rounded-full font-bold text-sm shadow-sm border border-border/20`}
                      />
                      <div className="truncate flex-1 space-y-0.5">
                        <div className="flex justify-between items-baseline">
                          <p className={`text-xs font-bold truncate ${isSelected ? "text-primary-foreground" : "text-foreground"}`}>
                            {convo.user.name || "Media Owner"}
                          </p>
                          <span className={`text-[8px] font-semibold shrink-0 ml-1 opacity-70 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`}>
                            {new Date(convo.lastMessage.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <p className={`text-[10px] truncate flex-1 pr-2 ${isSelected ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                            {isOutbound ? "You: " : ""}
                            {convo.lastMessage.content || (convo.lastMessage.media ? "Shared a file 📎" : "")}
                          </p>
                          {convo.unreadCount && convo.unreadCount > 0 ? (
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ml-1.5 ${
                              isSelected
                                ? "bg-white text-primary"
                                : "bg-primary text-primary-foreground animate-pulse"
                            }`}>
                              {convo.unreadCount} pending
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Right Workspace: Chat Active window */}
      <div className={`flex-1 flex flex-col bg-background/20 relative ${!selectedUser ? "hidden md:flex items-center justify-center text-center p-8" : "flex"}`}>
        
        {selectedUser ? (
          <>
            {/* Active Contact Header */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-card/25 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="md:hidden p-1.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <UserAvatar
                  avatarUrl={selectedUser.avatarUrl}
                  name={selectedUser.name}
                  email={selectedUser.email}
                  className="w-9 h-9 rounded-full font-bold text-xs shadow"
                />
                <div>
                  <h3 className="text-xs font-black text-foreground">{selectedUser.name || "Media Owner"}</h3>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{selectedUser.email}</p>
                </div>
              </div>
              
              {selectedUser.bio && (
                <div className="hidden sm:block text-[10px] text-muted-foreground italic truncate max-w-sm">
                  "{selectedUser.bio}"
                </div>
              )}
            </div>

            {/* Message Thread Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/5">
              {messagesLoading && messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground space-y-2 p-6 leading-relaxed">
                  <MessageSquare className="text-primary/40" size={36} />
                  <p className="text-xs font-bold">This is the start of your secure chat thread</p>
                  <p className="text-[10px] max-w-[280px]">Say hi, type a message, or select a file from your dashboard to share!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === currentUser?.id;
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200`}
                    >
                      {!isMe && (
                        <UserAvatar
                          avatarUrl={msg.sender.avatarUrl}
                          name={msg.sender.name}
                          email={msg.sender.email}
                          className="w-6 h-6 rounded-full font-bold text-[8px] mb-0.5 shrink-0"
                        />
                      )}
                      
                      <div className="flex flex-col space-y-1 max-w-[70%] sm:max-w-[50%]">
                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-sm ${
                            isMe
                              ? "bg-gradient-to-tr from-primary to-accent text-white rounded-br-none"
                              : "bg-muted text-foreground rounded-bl-none border border-border/40"
                          }`}
                        >
                          {/* Shared file attachment display card */}
                          {msg.media && (
                            <div
                              onClick={() => openLightboxForMedia(msg.media)}
                              className="mb-2 overflow-hidden rounded-xl border border-white/10 bg-black/30 cursor-pointer group hover:scale-[1.01] active:scale-98 transition-all relative"
                            >
                              {msg.media.type === "IMAGE" ? (
                                <img
                                  src={msg.media.thumbnailUrl || msg.media.url}
                                  alt={msg.media.filename}
                                  className="w-full aspect-[4/3] object-cover"
                                />
                              ) : (
                                <div className="w-full aspect-[4/3] bg-zinc-950 flex flex-col items-center justify-center p-3 text-center">
                                  <Video size={24} className="text-primary animate-pulse mb-1" />
                                  <p className="text-[10px] font-bold text-white/90 truncate w-full px-2">
                                    {msg.media.filename}
                                  </p>
                                  <span className="text-[8px] font-bold text-white/50 tracking-tight mt-1 bg-black/60 px-1.5 py-0.5 rounded">
                                    VIDEO
                                  </span>
                                </div>
                              )}
                              
                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[9px] font-bold bg-primary text-primary-foreground px-2 py-1 rounded-lg">
                                  Open in Lightbox
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Message body text */}
                          {msg.content && <p className="break-words white-space-pre-wrap">{msg.content}</p>}
                        </div>
                        <span className={`text-[8px] font-bold opacity-50 px-1 ${isMe ? "text-right" : "text-left"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </div>

            {/* Input Send Form Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-border/50 bg-card/15 backdrop-blur-md flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openMediaPicker}
                className="p-2.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Attach gallery media"
              >
                <Paperclip size={18} />
              </button>
              
              <input
                type="text"
                placeholder="Type a message secure thread..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-secondary/40 border border-border/80 focus:border-primary/50 text-foreground text-xs px-3.5 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                disabled={sendingMessage}
              />
              
              <button
                type="submit"
                disabled={sendingMessage || !inputText.trim()}
                className="p-3 rounded-xl bg-primary text-primary-foreground hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center transition-all shadow shadow-primary/25"
              >
                {sendingMessage ? (
                  <Loader2 className="animate-spin" size={15} />
                ) : (
                  <Send size={15} />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 max-w-sm">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <MessageSquare size={28} />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">Direct Message Center</h2>
              <p className="text-xs text-muted-foreground mt-1 px-4 leading-relaxed">
                Connect and pair-program or discuss artwork files with other host profiles. Search folders, invite users to chats, or attach files.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Modal Picker: Share Gallery Media */}
      {isMediaPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen size={16} className="text-primary" />
                <h3 className="text-xs font-black text-foreground">Attach Gallery Media</h3>
              </div>
              <button
                onClick={() => setIsMediaPickerOpen(false)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Search Bar */}
            <div className="p-3 bg-secondary/20 border-b border-border/40">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search media files by name..."
                  value={mediaSearchQuery}
                  onChange={(e) => setMediaSearchQuery(e.target.value)}
                  className="w-full bg-secondary/60 border border-border focus:border-primary/50 text-foreground text-xs pl-8 pr-4 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                />
                <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={13} />
              </div>
            </div>

            {/* Media Grid Scroll View */}
            <div className="max-h-[300px] overflow-y-auto p-4">
              {mediaLoading ? (
                <div className="py-12 flex justify-center items-center">
                  <Loader2 className="animate-spin text-primary" size={24} />
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground font-semibold">
                  No gallery files match your search filter
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2.5">
                  {filteredMedia.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSendMediaAttachment(item.id)}
                      className="group overflow-hidden rounded-xl border border-border hover:border-primary transition-all bg-secondary/20 relative aspect-square text-left cursor-pointer flex flex-col justify-between"
                    >
                      <div className="w-full h-full relative overflow-hidden bg-zinc-950">
                        {item.type === "IMAGE" ? (
                          <img
                            src={item.thumbnailUrl || item.url}
                            alt={item.filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                            <Video size={16} className="text-primary" />
                            <span className="text-[6px] text-white/50 mt-1 uppercase font-bold tracking-tight bg-black/60 px-1 rounded">
                              VIDEO
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[8px] bg-primary text-primary-foreground px-2 py-0.5 rounded font-black">
                            Share Attachment
                          </span>
                        </div>
                      </div>
                      <div className="p-1.5 bg-card border-t border-border shrink-0 truncate w-full">
                        <span className="text-[9px] font-bold text-foreground block truncate">
                          {item.filename}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox full-fidelity display */}
      {activeLightboxMedia && (
        <Lightbox
          media={activeLightboxMedia}
          onClose={() => setActiveLightboxMedia(null)}
          hideSuggestions={true}
        />
      )}
      
    </div>
  );
}
