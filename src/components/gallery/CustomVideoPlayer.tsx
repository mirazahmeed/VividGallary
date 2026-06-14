"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
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
  RotateCw,
  Loader2,
  Camera,
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
  onNext?: () => void;
  onPrev?: () => void;
}

export default function CustomVideoPlayer({
  src,
  className = "",
  autoPlay = false,
  onEnded,
  downloadAllowed = true,
  filename = "video.mp4",
  onNext,
  onPrev
}: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user, addNotification } = useApp();
  const [capturing, setCapturing] = useState(false);

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
  const [hasEnded, setHasEnded] = useState(false);

  // Settings & HUD States (YouTube-style Quality/Speed & anim overlay)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsActiveMenu, setSettingsActiveMenu] = useState<"main" | "speed" | "quality">("main");
  const [quality, setQuality] = useState("Auto");
  const [videoAspectRatio, setVideoAspectRatio] = useState("16/9");
  const [showHudIcon, setShowHudIcon] = useState<"play" | "pause" | "rewind" | "forward" | null>(null);

  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    setHasEnded(false);
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
        setShowSettingsMenu(false);
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
    if (hasEnded) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setHasEnded(false);
      setShowHudIcon("play");
    } else if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowHudIcon("pause");
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setHasEnded(false);
      setShowHudIcon("play");
    }

    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowHudIcon(null), 500);

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

    // Dynamically adjust container aspect ratio to match raw video dimensions
    const width = videoRef.current.videoWidth;
    const height = videoRef.current.videoHeight;
    if (width && height) {
      setVideoAspectRatio(`${width} / ${height}`);
    }
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

    // HUD trigger for skip feedback
    setShowHudIcon(seconds > 0 ? "forward" : "rewind");
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowHudIcon(null), 500);
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
    setShowSettingsMenu(false);
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

  const handleCaptureFrame = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    setCapturing(true);
    addNotification("Capture", "Extracting frame from video timeline...", "info");
    
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) throw new Error("Could not construct 2D context");
      
      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob and upload
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setCapturing(false);
          return;
        }

        try {
          const rawName = filename.replace(/\.[^/.]+$/, "");
          const file = new File([blob], `frame_${rawName}_${Math.round(video.currentTime)}s.jpg`, {
            type: "image/jpeg",
          });

          const formData = new FormData();
          formData.append("files", file);

          const res = await fetch("/api/media/upload", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            addNotification("Success", "Frame captured and saved to gallery", "success");
          } else {
            const err = await res.json();
            throw new Error(err.error || "Upload failed");
          }
        } catch (err: any) {
          console.error("Frame upload failed:", err);
          addNotification("Capture Failed", err.message || "Failed to save captured frame copy", "error");
        } finally {
          setCapturing(false);
        }
      }, "image/jpeg", 0.95);
    } catch (err: any) {
      console.error(err);
      addNotification("Capture Failed", "Could not process video timeline frame", "error");
      setCapturing(false);
    }
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

  const getQualityFilter = () => {
    switch (quality) {
      case "720p":
        return "blur(0.25px)";
      case "480p":
        return "blur(0.8px)";
      case "360p":
        return "blur(1.6px)";
      default:
        return "none";
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={`relative overflow-hidden rounded-2xl bg-black border border-white/5 flex items-center justify-center group focus:outline-none select-none w-full max-w-full ${className}`}
      style={{ aspectRatio: videoAspectRatio }}
      onContextMenu={(e) => e.preventDefault()}
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
        onPlay={() => {
          setIsPlaying(true);
          setHasEnded(false);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setHasEnded(true);
          setIsPlaying(false);
          if (onEnded) onEnded();
        }}
        onClick={handleVideoTap}
        className="w-full h-full object-contain cursor-pointer transition-[filter] duration-300"
        style={{ filter: getQualityFilter() }}
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
          <RotateCcw size={20} className="text-white" />
        </div>
      )}

      {/* YouTube Center HUD Overlay */}
      {showHudIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-fade-out">
          <div className="hud-anim w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white">
            {showHudIcon === "play" && <Play size={24} fill="currentColor" className="ml-1" />}
            {showHudIcon === "pause" && <Pause size={24} fill="currentColor" />}
            {showHudIcon === "rewind" && <RotateCcw size={24} />}
            {showHudIcon === "forward" && <RotateCw size={24} />}
          </div>
        </div>
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
            className="yt-seek-input flex-1 h-1 sm:h-1 rounded-full cursor-pointer transition-all"
            style={{
              touchAction: "none",
              background: `linear-gradient(to right, #ff0000 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%)`
            }}
          />
          <span className="text-[10px] font-mono text-white/80 select-none">
            {formatTime(duration)}
          </span>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center justify-between w-full">
          {/* Left tools: Play, 10s Rewind/Forward, Vol */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {onPrev && (
              <button
                onClick={onPrev}
                className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform flex items-center justify-center"
                title="Previous Video"
              >
                <SkipBack size={14} fill="currentColor" />
              </button>
            )}

            <button
              onClick={togglePlay}
              className="p-2.5 sm:p-2 min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform flex items-center justify-center"
              title={hasEnded ? "Replay" : isPlaying ? "Pause" : "Play"}
            >
              {hasEnded ? (
                <RotateCcw size={16} />
              ) : isPlaying ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" />
              )}
            </button>

            {onNext && (
              <button
                onClick={onNext}
                className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform flex items-center justify-center"
                title="Next Video"
              >
                <SkipForward size={14} fill="currentColor" />
              </button>
            )}

            {/* Rewind 10s */}
            <button
              onClick={() => seekBy(-10)}
              className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform flex items-center justify-center gap-0.5"
              title="Rewind 10s"
            >
              <RotateCcw size={14} />
              <span className="text-[9px] font-black">10</span>
            </button>

            {/* Forward 10s */}
            <button
              onClick={() => seekBy(10)}
              className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-90 transition-transform flex items-center justify-center gap-0.5"
              title="Forward 10s"
            >
              <RotateCw size={14} />
              <span className="text-[9px] font-black">10</span>
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

          {/* Right tools: Settings Menu, PiP, Download, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2 relative">
            {/* YouTube style Settings Panel */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSettingsMenu(!showSettingsMenu);
                  setSettingsActiveMenu("main");
                }}
                className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer px-2 sm:px-2.5 flex items-center gap-1 justify-center"
                title="Settings"
              >
                <Settings size={14} />
                <span className="text-[9px] bg-primary/20 text-primary font-bold px-1 rounded uppercase scale-90">
                  {quality === "Auto" ? "Auto" : quality}
                </span>
              </button>

              {showSettingsMenu && (
                <div className="absolute bottom-11 right-0 w-44 bg-black/95 backdrop-blur-md border border-white/10 rounded-xl py-2 z-45 flex flex-col shadow-2xl animate-in slide-in-from-bottom-2 duration-200 text-white text-xs">
                  {settingsActiveMenu === "main" && (
                    <>
                      <div className="text-[9px] font-extrabold text-white/40 px-3 pb-1 border-b border-white/5 uppercase">
                        Settings
                      </div>
                      <button
                        onClick={() => setSettingsActiveMenu("quality")}
                        className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors flex justify-between items-center"
                      >
                        <span>Quality</span>
                        <span className="text-[10px] text-white/50">{quality} ›</span>
                      </button>
                      <button
                        onClick={() => setSettingsActiveMenu("speed")}
                        className="w-full text-left px-3 py-2 hover:bg-white/10 transition-colors flex justify-between items-center"
                      >
                        <span>Speed</span>
                        <span className="text-[10px] text-white/50">{playbackRate === 1 ? "Normal" : `${playbackRate}x`} ›</span>
                      </button>
                    </>
                  )}

                  {settingsActiveMenu === "quality" && (
                    <>
                      <button
                        onClick={() => setSettingsActiveMenu("main")}
                        className="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors text-primary font-black border-b border-white/5"
                      >
                        ‹ Back to Settings
                      </button>
                      {["Auto", "1080p", "720p", "480p", "360p"].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setQuality(q);
                            setShowSettingsMenu(false);
                            addNotification("Quality Selected", `Video stream quality switched to ${q}`, "success");
                          }}
                          className={`w-full text-left px-4 py-1.5 transition-colors hover:bg-white/10 flex justify-between items-center ${
                            quality === q ? "text-primary font-bold" : "text-white/80"
                          }`}
                        >
                          <span>{q}</span>
                          {quality === q && <span className="text-[10px] text-primary">✓</span>}
                        </button>
                      ))}
                    </>
                  )}

                  {settingsActiveMenu === "speed" && (
                    <>
                      <button
                        onClick={() => setSettingsActiveMenu("main")}
                        className="w-full text-left px-3 py-1.5 hover:bg-white/10 transition-colors text-primary font-black border-b border-white/5"
                      >
                        ‹ Back to Settings
                      </button>
                      {[0.5, 1, 1.25, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => {
                            changeSpeed(speed);
                            setShowSettingsMenu(false);
                          }}
                          className={`w-full text-left px-4 py-1.5 transition-colors hover:bg-white/10 flex justify-between items-center ${
                            playbackRate === speed ? "text-primary font-bold" : "text-white/80"
                          }`}
                        >
                          <span>{speed === 1 ? "Normal" : `${speed}x`}</span>
                          {playbackRate === speed && <span className="text-[10px] text-primary">✓</span>}
                        </button>
                      ))}
                    </>
                  )}
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

            {/* Frame Capture */}
            {user && (
              <button
                onClick={handleCaptureFrame}
                disabled={capturing}
                className="p-2 min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
                title="Capture video frame copy"
              >
                {capturing ? (
                  <Loader2 size={14} className="animate-spin text-primary" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
            )}

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

      <style jsx global>{`
        /* Custom YouTube-style seek input */
        .yt-seek-input {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
        }
        .yt-seek-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ff0000;
          cursor: pointer;
          transition: transform 0.1s ease;
          transform: scale(0); /* Hide by default */
        }
        .yt-seek-input:hover::-webkit-slider-thumb {
          transform: scale(1); /* Show on hover */
        }
        .yt-seek-input::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border: none;
          border-radius: 50%;
          background: #ff0000;
          cursor: pointer;
          transition: transform 0.1s ease;
          transform: scale(0);
        }
        .yt-seek-input:hover::-moz-range-thumb {
          transform: scale(1);
        }

        /* Center HUD Animation */
        .hud-anim {
          animation: youtubeHud 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes youtubeHud {
          0% { transform: scale(0.5); opacity: 0; }
          40% { transform: scale(1.15); opacity: 0.9; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
