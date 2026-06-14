import React, { useState } from "react";

interface UserAvatarProps {
  avatarUrl: string | null | undefined;
  name: string | null | undefined;
  email?: string | null | undefined;
  className?: string;
}

export default function UserAvatar({
  avatarUrl,
  name,
  email,
  className = "w-8 h-8 rounded-full text-xs font-black"
}: UserAvatarProps) {
  const [error, setError] = useState(false);

  // Fallback to first two letters of name or email, or "?"
  const fallbackText = (name || email || "?").substring(0, 2).toUpperCase();

  return (
    <div className={`bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white shrink-0 overflow-hidden shadow-sm ${className}`}>
      {avatarUrl && !error ? (
        <img
          src={avatarUrl}
          alt={name || ""}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span>{fallbackText}</span>
      )}
    </div>
  );
}
