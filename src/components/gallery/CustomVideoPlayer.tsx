"use client";

import React, { useRef, useState, useEffect } from "react";
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
  Loader2
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

  // Blob URL states for security
  const [videoBlobUrl, setVideoBlobUrl] = useState<string>("");
  const [blobLoading, setBlobLoading] = useState(false);

  // Controls auto-hide timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset states on src change
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
    setVideoBlobUrl("");

    if (!src) return;

    if (src.startsWith("blob:")) {
      setVideoBlobUrl(src);
      setLoading(false);
      return;
    }

    setBlobLoading(true);
    const controller = new AbortController();

    const fetchVideo = async () => {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error("Fetch failed");
        const blob = await response.blob();
        const localUrl = URL.createObjectURL(blob);
        setVideoBlobUrl(localUrl);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Failed to load video blob, falling back to direct URL", err);
          setVideoBlobUrl(src);
        }
      } finally {
        setBlobLoading(false);
        // Trigger load in the video tag once url is set
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.load();
          }
        }, 50);
      }
    };

    fetchVideo();

    return () => {
      controller.abort();
      if (videoBlobUrl && videoBlobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(videoBlobUrl);
      }
    };
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
    }, 2500);
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
    link.href = videoBlobUrl || src;
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
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoBlobUrl || undefined}
        autoPlay={autoPlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Loading Overlay */}
      {(loading || blobLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-30">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      )}

      {/* Big Center Play/Pause HUD Indicator (Shows briefly or when paused) */}
      {(!isPlaying || loading) && !loading && (
        <button
          onClick={togglePlay}
          className="absolute w-16 h-16 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-20 shadow-2xl cursor-pointer"
        >
          <Play size={24} fill="currentColor" className="ml-1" />
        </button>
      )}

      {/* Control Bar Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-4 pt-10 flex flex-col gap-3 transition-opacity duration-300 z-20 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Seek timeline bar */}
        <div className="flex items-center gap-3 w-full group/seek">
          <span className="text-[10px] font-mono text-white/80 select-none">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeekChange}
            className="flex-1 h-1.5 rounded-full bg-white/20 accent-primary cursor-pointer hover:h-2 transition-all"
            style={{
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
          {/* Left tools: Play, Vol */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform"
            >
              {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            </button>

            {/* Volume controls */}
            <div className="flex items-center gap-1.5 group/vol">
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

          {/* Right tools: Download, Speed, PiP, Fullscreen */}
          <div className="flex items-center gap-2 relative">
            {/* Speed settings toggle */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black cursor-pointer px-2.5 flex items-center gap-1"
              >
                <Settings size={14} /> {playbackRate}x
              </button>

              {/* Speed Popover Menu */}
              {showSpeedMenu && (
                <div className="absolute bottom-10 right-0 w-24 bg-black/95 backdrop-blur-md border border-white/10 rounded-xl py-1 z-30 flex flex-col shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
                  {[0.5, 1, 1.25, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => changeSpeed(speed)}
                      className={`w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors hover:bg-white/10 ${
                        playbackRate === speed ? "text-primary font-black" : "text-white/80"
                      }`}
                    >
                      {speed === 1 ? "Normal" : `${speed}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PiP */}
            <button
              onClick={togglePiP}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              title="Picture in Picture"
            >
              <Tv size={14} />
            </button>

            {/* Download Option */}
            {downloadAllowed && (
              <button
                onClick={handleDownload}
                className="p-2 rounded-xl bg-primary/20 hover:bg-primary/45 border border-primary/20 text-white cursor-pointer active:scale-95 transition-all"
                title="Download video file"
              >
                <Download size={14} />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
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
