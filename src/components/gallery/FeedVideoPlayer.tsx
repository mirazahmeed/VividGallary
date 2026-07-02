"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize2 } from "lucide-react";

interface FeedVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * A feed-optimized video player that:
 * - Autoplays (muted) when scrolled into viewport via IntersectionObserver
 * - Pauses when scrolled out of view
 * - Shows play/pause overlay controls
 * - Allows unmuting on click
 * - Displays a progress bar and duration
 */
export default function FeedVideoPlayer({
  src,
  poster,
  className = "",
  onClick,
}: FeedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // IntersectionObserver: autoplay when >50% visible, pause when out
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Handle play/pause based on visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isVisible) {
      video.play().catch(() => {
        // Autoplay blocked — ignore
      });
    } else {
      video.pause();
    }
  }, [isVisible]);

  // Sync playing state from video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration && isFinite(video.duration)) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    const onLoadedMetadata = () => {
      if (video.duration && isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, []);

  const togglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setHasInteracted(true);
      const video = videoRef.current;
      if (!video) return;

      if (video.paused) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    },
    []
  );

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setHasInteracted(true);
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const video = videoRef.current;
      const bar = progressRef.current;
      if (!video || !bar || !video.duration) return;

      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.currentTime = fraction * video.duration;
    },
    []
  );

  const handleOpenLightbox = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.();
    },
    [onClick]
  );

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-black group ${className}`}
      onMouseEnter={showControlsTemporarily}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => setShowControls(false)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted={isMuted}
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
      />

      {/* Gradient overlays for controls visibility */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Top gradient */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
      </div>

      {/* Center play button (shown when paused and not hovered) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
            <Play size={24} className="text-white ml-0.5" fill="white" />
          </div>
        </div>
      )}

      {/* Bottom controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-1 z-20 transition-all duration-300 ${
          showControls || !isPlaying ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="w-full h-1 bg-white/20 rounded-full mb-2.5 cursor-pointer group/progress relative"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-primary rounded-full relative transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control buttons row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="text-white hover:text-primary transition-colors cursor-pointer p-0.5"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" className="ml-0.5" />}
            </button>

            {/* Mute/Unmute */}
            <button
              onClick={toggleMute}
              className="text-white hover:text-primary transition-colors cursor-pointer p-0.5"
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Duration */}
            <span className="text-[10px] font-mono text-white/80 select-none tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Expand / Lightbox button */}
          {onClick && (
            <button
              onClick={handleOpenLightbox}
              className="text-white hover:text-primary transition-colors cursor-pointer p-1 rounded-md hover:bg-white/10"
              aria-label="Open in Lightbox"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Muted indicator badge (subtle, shown when autoplaying muted) */}
      {isMuted && isPlaying && !showControls && (
        <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md bg-black/50 backdrop-blur-sm border border-white/10 flex items-center gap-1 pointer-events-none">
          <VolumeX size={10} className="text-white/70" />
          <span className="text-[8px] text-white/60 font-bold uppercase tracking-wider">Muted</span>
        </div>
      )}
    </div>
  );
}
