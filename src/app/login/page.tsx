"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { ShieldCheck, Mail, Lock, User, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { user, refreshUser, addNotification } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync state if redirected with ?register=true
  useEffect(() => {
    if (searchParams.get("register") === "true") {
      setIsRegister(true);
    }
  }, [searchParams]);

  // Redirect to Dashboard if already authenticated
  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      addNotification("Error", "Please fill in all credentials", "error");
      return;
    }

    setLoading(true);
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const body = isRegister ? { email, password, name } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        addNotification(
          isRegister ? "Registration Successful" : "Welcome Back",
          isRegister ? "Your account has been created successfully" : "Logged in successfully",
          "success"
        );
        await refreshUser();
        router.push("/");
      } else {
        addNotification("Auth Failed", data.error || "Credentials verification failed", "error");
      }
    } catch {
      addNotification("Error", "Server connection failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Visual background neon gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full filter blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent/20 rounded-full filter blur-3xl" />

      {/* Auth Card Layout */}
      <div className="w-full max-w-md glass rounded-3xl p-8 border border-border shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shadow-lg mb-4">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-2xl font-black text-foreground">
            {isRegister ? "Create Account" : "Access Gallery"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 text-center max-w-[280px]">
            {isRegister
              ? "Register to host, organize, and share your personal media catalog."
              : "Enter your host credentials to unlock your secure media catalog."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4.5">
          {isRegister && (
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-secondary/40 border border-border/80 focus:border-primary/60 text-foreground text-xs pl-10 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-primary/25 transition-all"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-secondary/40 border border-border/80 focus:border-primary/60 text-foreground text-xs pl-10 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-primary/25 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-secondary/40 border border-border/80 focus:border-primary/60 text-foreground text-xs pl-10 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-1 focus:ring-primary/25 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-primary to-accent text-white font-bold text-xs shadow-lg hover:shadow-primary/20 hover:scale-[1.01] active:scale-99 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : isRegister ? (
              "Sign Up"
            ) : (
              "Authorize Session"
            )}
          </button>
        </form>

        {/* Dynamic switcher footer */}
        <div className="mt-8 pt-6 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground">
            {isRegister ? "Already configured?" : "First-time host setup?"}{" "}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="text-primary font-bold hover:underline cursor-pointer ml-1"
            >
              {isRegister ? "Authorize Login" : "Initialize Register"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
