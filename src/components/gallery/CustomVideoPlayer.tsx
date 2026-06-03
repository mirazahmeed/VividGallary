"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Settings,
  Tv,
  RotateCcw,
  Loader2,
  SkipBack,
  SkipForward
} from "lucide-react";

interface CustomVideoPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  onEnded?: () => void;
  downloadAllowed?: boolean;
  filename?: string;
}

export default function CustomVideoPlayer({
  src,
  className = "",
  autoPlay = false,
  onEnded,
  downloadAllowed = true,
  filename = "video.mp4"
}: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Double-tap seek feedback
  const [seekFeedback, setSeekFeedback] = useState<"left" | "right" | null>(null);
  const doubleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // Controls auto-hide timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset states on src change
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
  }, [src]);

  // Handle controls visibility fade out
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    resetControlsTimeout();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setLoading(false);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = Number(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    resetControlsTimeout();
  };

  const seekBy = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = Number(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
    resetControlsTimeout();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuteState = !isMuted;
    videoRef.current.muted = nextMuteState;
    setIsMuted(nextMuteState);
    if (!nextMuteState && volume === 0) {
      videoRef.current.volume = 0.5;
      setVolume(0.5);
    }
    resetControlsTimeout();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    resetControlsTimeout();
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP error:", err);
    }
    resetControlsTimeout();
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
    resetControlsTimeout();
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Time formatter (MM:SS)
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Double-tap to seek handler for touch
  const handleVideoTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = "touches" in e ? e.changedTouches?.[0]?.clientX || 0 : e.clientX;
    const relativeX = clientX - rect.left;
    const isLeftHalf = relativeX < rect.width / 2;
    const timeSinceLastTap = now - lastTapRef.current.time;

    if (timeSinceLastTap < 350) {
      // Double tap detected
      if (isLeftHalf) {
        seekBy(-10);
        setSeekFeedback("left");
      } else {
        seekBy(10);
        setSeekFeedback("right");
      }
      setTimeout(() => setSeekFeedback(null), 600);
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: clientX };
      // Single tap — toggle play/pause after a short delay
      if (doubleTapTimerRef.current) clearTimeout(doubleTapTimerRef.current);
      doubleTapTimerRef.current = setTimeout(() => {
        if (Date.now() - lastTapRef.current.time >= 300) {
          togglePlay();
        }
      }, 350);
    }
    resetControlsTimeout();
  }, [duration, isPlaying]);

  // Keyboard controls
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "f") {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === "m") {
      e.preventDefault();
      toggleMute();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekBy(-10);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seekBy(10);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`relative overflow-hidden rounded-2xl bg-black border border-white/5 flex items-center justify-center group focus:outline-none select-none max-w-full ${className}`}
      style={{ aspectRatio: "16/9" }}
    >
      {/* Video element — uses direct URL, no blob fetching */}
      <video
        ref={videoRef}
        src={src || undefined}
        autoPlay={autoPlay}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        onClick={handleVideoTap}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30 pointer-events-none">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      )}

      {/* Double-tap seek feedback */}
      {seekFeedback && (
        <div className={`absolute top-1/2 -translate-y-1/2 ${seekFeedback === "left" ? "left-8" : "right-8"} bg-white/20 backdrop-blur-md rounded-full p-3 animate-ping pointer-events-none z-20`}>
          {seekFeedback === "left" ? <SkipBack size={20} className="text-white" /> : <SkipForward size={20} className="text-white" />}
        </div>
      )}

      {/* Big Center Play/Pause HUD Indicator */}
      {!isPlaying && !loading && (
        <button
          onClick={togglePlay}
          className="absolute w-16 h-16 sm:w-16 sm:h-16 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-20 shadow-2xl cursor-pointer"
        >
          <Play size={24} fill="currentColor" className="ml-1" />
        </button>
      )}

      {/* Control Bar Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 sm:px-4 pb-3 sm:pb-4 pt-8 sm:pt-10 flex flex-col gap-2 sm:gap-3 transition-opacity duration-300 z-20 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Seek timeline bar — taller on mobile for easier touch dragging */}
        <div className="flex items-center gap-2 sm:gap-3 w-full group/seek">
          <span className="text-[10px] font-mono text-white/80 select-none">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeekChange}
            className="flex-1 h-2 sm:h-1.5 rounded-full bg-white/20 accent-primary cursor-pointer hover:h-2.5 transition-all"
            style={{
              touchAction: "none",
              background: `linear-gradient(to right, var(--color-primary, #6366f1) ${
                (currentTime / (duration || 1)) * 100
              }%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%)`
            }}
          />
          <span className="text-[10px] font-mono text-white/80 select-none">
            {formatTime(duration)}
          </span>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between w-full">
          {/* Left tools: Play, Skip, Vol */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={() => seekBy(-10)}
              className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform hidden sm:flex items-center justify-center"
              title="Rewind 10s"
            >
              <SkipBack size={14} />
            </button>
            <button
              onClick={togglePlay}
              className="p-2.5 sm:p-2 min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform flex items-center justify-center"
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <button
              onClick={() => seekBy(10)}
              className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform hidden sm:flex items-center justify-center"
              title="Forward 10s"
            >
              <SkipForward size={14} />
            </button>

            {/* Volume controls — hidden on mobile */}
            <div className="hidden sm:flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 overflow-hidden group-hover/vol:w-16 h-1 rounded bg-white/20 accent-white transition-all cursor-pointer"
              />
            </div>
          </div>

          {/* Right tools: Speed, PiP, Download, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2 relative">
            {/* Speed settings toggle */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black cursor-pointer px-2 sm:px-2.5 flex items-center gap-1 justify-center"
              >
                <Settings size={14} /> <span className="hidden sm:inline">{playbackRate}x</span>
              </button>

              {/* Speed Popover Menu */}
              {showSpeedMenu && (
                <div className="absolute bottom-10 right-0 w-24 bg-black/95 backdrop-blur-md border border-white/10 rounded-xl py-1 z-30 flex flex-col shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
                  {[0.5, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => changeSpeed(speed)}
                      className={`w-full text-left px-3 py-2 sm:py-1.5 text-[11px] sm:text-[10px] font-bold transition-colors hover:bg-white/10 ${
                        playbackRate === speed ? "text-primary font-black" : "text-white/80"
                      }`}
                    >
                      {speed === 1 ? "Normal" : `${speed}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PiP — hidden on mobile */}
            <button
              onClick={togglePiP}
              className="hidden sm:flex p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer items-center justify-center"
              title="Picture in Picture"
            >
              <Tv size={14} />
            </button>

            {/* Download Option */}
            {downloadAllowed && (
              <button
                onClick={handleDownload}
                className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-primary/20 hover:bg-primary/45 border border-primary/20 text-white cursor-pointer active:scale-95 transition-all flex items-center justify-center"
                title="Download video file"
              >
                <Download size={14} />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer flex items-center justify-center"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
