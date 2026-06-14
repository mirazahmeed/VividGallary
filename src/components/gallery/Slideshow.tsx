import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { MediaItem } from "./Lightbox";
import CustomVideoPlayer from "./CustomVideoPlayer";

interface SlideshowProps {
  items: MediaItem[];
  onClose: () => void;
}

export default function Slideshow({ items, onClose }: SlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(3); // delay in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentItem = items[currentIndex];

  useEffect(() => {
    if (!currentItem) return;

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (paused) return;

    // If current item is a video, don't set auto-advance timer. Let the video finish!
    if (currentItem.type === "VIDEO") {
      return;
    }

    // Set timer to advance slide
    timerRef.current = setTimeout(() => {
      handleNext();
    }, speed * 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex, paused, speed, items]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleVideoEnded = () => {
    handleNext();
  };

  if (items.length === 0 || !currentItem) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black z-55 flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-300">
      {/* Top Controls Navbar */}
      <div className="p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white relative z-10">
        <div>
          <h2 className="text-sm font-black truncate max-w-[220px]">Slideshow Mode</h2>
          <span className="text-[9px] text-white/50 uppercase font-extrabold tracking-widest mt-0.5 inline-block">
            Slide {currentIndex + 1} of {items.length}
          </span>
        </div>

        {/* Action controllers */}
        <div className="flex items-center gap-4">
          {/* Custom delay slider for images */}
          {currentItem.type === "IMAGE" && (
            <div className="flex items-center gap-1.5 text-xs text-white/70">
              <span className="text-[8px] font-bold uppercase tracking-wider hidden sm:inline">
                Delay: {speed}s
              </span>
              <input
                type="range"
                min={1}
                max={10}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-16 sm:w-20 accent-primary h-1 rounded bg-white/20 focus:outline-none cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setPaused(!paused)}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer active:scale-95 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center"
              title={paused ? "Resume slideshow" : "Pause slideshow"}
            >
              {paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} />}
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white hover:text-rose-500 cursor-pointer active:scale-95 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center border border-transparent hover:border-rose-500/10"
              title="Close slideshow"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Slide Stage */}
      <div className="flex-1 flex items-center justify-center relative p-8">
        {/* Progress bar representing delay time (resets on slide change) */}
        {currentItem.type === "IMAGE" && !paused && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-20">
            <div
              key={currentIndex} // forces re-render/re-animating of the bar
              className="h-full bg-primary"
              style={{
                animation: `slideshowProgress ${speed}s linear forwards`
              }}
            />
          </div>
        )}

        <style jsx global>{`
          @keyframes slideshowProgress {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>

        {currentItem.type === "IMAGE" ? (
          <img
            src={currentItem.url}
            alt={currentItem.filename}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl transition-all duration-300"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <CustomVideoPlayer
            src={currentItem.url}
            autoPlay
            onEnded={handleVideoEnded}
            filename={currentItem.filename}
            className="max-w-full max-h-[80vh] shadow-2xl"
            onNext={handleNext}
            onPrev={handlePrev}
          />
        )}
      </div>

      {/* Bottom controls arrows */}
      <div className="p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6 text-white relative z-10 w-full">
        <button
          onClick={handlePrev}
          className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl active:scale-95 transition-all cursor-pointer min-w-[44px]"
        >
          Prev
        </button>
        <span className="text-[11px] font-black text-white/80 select-none truncate max-w-[150px] sm:max-w-xs">
          {currentItem.filename}
        </span>
        <button
          onClick={handleNext}
          className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl active:scale-95 transition-all cursor-pointer min-w-[44px]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
