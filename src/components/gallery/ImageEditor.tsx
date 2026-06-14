import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  RotateCw, 
  FlipHorizontal, 
  FlipVertical, 
  Sliders, 
  Crop as CropIcon, 
  Loader2, 
  Save, 
  RotateCcw,
  Sparkles
} from "lucide-react";
import { MediaItem } from "./Lightbox";
import { useApp } from "@/context/AppContext";

interface ImageEditorProps {
  media: MediaItem;
  onClose: () => void;
  onSaveSuccess: (newMedia: MediaItem) => void;
}

export default function ImageEditor({ media, onClose, onSaveSuccess }: ImageEditorProps) {
  const { addNotification } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filter Values
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [invert, setInvert] = useState(0);
  const [blur, setBlur] = useState(0);

  // Transform Values
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"filters" | "crop" | "presets">("filters");

  // Crop Box States (expressed in percentages of preview container)
  const [cropActive, setCropActive] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 80 });
  const [aspectRatio, setAspectRatio] = useState<number | null>(null); // null represents free

  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cropBoxRef = useRef<HTMLDivElement | null>(null);

  // Dragging crop box states
  const dragStartRef = useRef<{ x: number, y: number, boxX: number, boxY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number, y: number, boxW: number, boxH: number, handle: string } | null>(null);

  useEffect(() => {
    // If aspectRatio changes and crop is active, recalculate height
    if (aspectRatio && cropActive) {
      setCropBox((prev) => {
        const newH = Math.min(80, prev.w / aspectRatio);
        return { ...prev, h: newH };
      });
    }
  }, [aspectRatio, cropActive]);

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setGrayscale(0);
    setSepia(0);
    setInvert(0);
    setBlur(0);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCropActive(false);
    setAspectRatio(null);
    setCropBox({ x: 10, y: 10, w: 80, h: 80 });
    addNotification("Reset Done", "All editor settings cleared", "info");
  };

  const applyPreset = (presetName: string) => {
    // Reset first
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setGrayscale(0);
    setSepia(0);
    setInvert(0);
    setBlur(0);

    switch (presetName) {
      case "vivid":
        setBrightness(110);
        setContrast(120);
        setSaturate(130);
        break;
      case "vintage":
        setSepia(50);
        setContrast(90);
        setBrightness(95);
        break;
      case "noir":
        setGrayscale(100);
        setContrast(130);
        break;
      case "cool":
        setSaturate(85);
        setContrast(105);
        // We simulate cool tint with slightly higher brightness/grayscale saturation
        break;
      case "dramatic":
        setContrast(150);
        setBrightness(90);
        break;
      case "retro":
        setSepia(30);
        setContrast(110);
        setSaturate(120);
        break;
    }
    addNotification("Preset Applied", `${presetName} filters selected`, "success");
  };

  const handleSave = async () => {
    if (!imageRef.current) return;
    setSaving(true);

    try {
      const img = imageRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not create canvas 2D context");

      // Load image on clean canvas with correct orientation
      const is90or270 = (rotation / 90) % 2 !== 0;
      let targetWidth = is90or270 ? img.naturalHeight : img.naturalWidth;
      let targetHeight = is90or270 ? img.naturalWidth : img.naturalHeight;

      // Apply crop adjustments if active
      let cropX = 0;
      let cropY = 0;
      let cropW = img.naturalWidth;
      let cropH = img.naturalHeight;

      if (cropActive) {
        // Calculate crop coords relative to original image size
        // Since original image gets rotated, we must crop in the rotated coordinates or source coordinates.
        // It is simpler to crop on the pre-rotated image coordinates.
        cropX = (cropBox.x / 100) * img.naturalWidth;
        cropY = (cropBox.y / 100) * img.naturalHeight;
        cropW = (cropBox.w / 100) * img.naturalWidth;
        cropH = (cropBox.h / 100) * img.naturalHeight;

        // Clip margins
        cropX = Math.max(0, Math.min(img.naturalWidth, cropX));
        cropY = Math.max(0, Math.min(img.naturalHeight, cropY));
        cropW = Math.max(50, Math.min(img.naturalWidth - cropX, cropW));
        cropH = Math.max(50, Math.min(img.naturalHeight - cropY, cropH));

        // Re-evaluate target canvas sizes
        targetWidth = is90or270 ? cropH : cropW;
        targetHeight = is90or270 ? cropW : cropH;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Apply HTML5 Canvas Filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) sepia(${sepia}%) invert(${invert}%) saturate(${saturate}%) blur(${blur}px)`;

      // Draw rotated and flipped image
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      if (cropActive) {
        // Draw the cropped portion of the image centered
        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropW,
          cropH,
          -cropW / 2,
          -cropH / 2,
          cropW,
          cropH
        );
      } else {
        ctx.drawImage(
          img,
          -img.naturalWidth / 2,
          -img.naturalHeight / 2
        );
      }

      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);

      // Submit to backend
      const res = await fetch(`/api/media/${media.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl,
          filename: media.filename
        }),
      });

      if (res.ok) {
        const data = await res.json();
        addNotification("Success", "Edited copy saved to gallery", "success");
        onSaveSuccess(data.media);
        onClose();
      } else {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
    } catch (err: any) {
      console.error(err);
      addNotification("Save Failed", err.message || "Failed to process photo edit", "error");
    } finally {
      setSaving(false);
    }
  };

  // Drag handles for visual Crop Overlay
  const startDragBox = (e: React.MouseEvent) => {
    if (e.target !== cropBoxRef.current) return; // only drag on body
    e.preventDefault();
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y
    };
  };

  const startResizeBox = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      boxW: cropBox.w,
      boxH: cropBox.h,
      handle
    };
  };

  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (dragStartRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;

      let newX = dragStartRef.current.boxX + deltaX;
      let newY = dragStartRef.current.boxY + deltaY;

      // Bound checks
      newX = Math.max(0, Math.min(100 - cropBox.w, newX));
      newY = Math.max(0, Math.min(100 - cropBox.h, newY));

      setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
    }

    if (resizeStartRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStartRef.current.y) / rect.height) * 100;
      const { handle, boxW, boxH } = resizeStartRef.current;

      let newW = boxW;
      let newH = boxH;

      if (handle.includes("e")) newW = Math.max(10, Math.min(100 - cropBox.x, boxW + deltaX));
      if (handle.includes("s")) newH = Math.max(10, Math.min(100 - cropBox.y, boxH + deltaY));

      if (aspectRatio) {
        if (handle.includes("e")) {
          newH = Math.min(100 - cropBox.y, newW / aspectRatio);
        } else if (handle.includes("s")) {
          newW = Math.min(100 - cropBox.x, newH * aspectRatio);
        }
      }

      setCropBox((prev) => ({ ...prev, w: newW, h: newH }));
    }
  };

  const handleGlobalMouseUp = () => {
    dragStartRef.current = null;
    resizeStartRef.current = null;
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [cropBox, aspectRatio]);

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-md z-55 flex flex-col justify-between overflow-hidden text-foreground animate-in fade-in duration-200">
      {/* 1. Header Toolbar */}
      <div className="p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary" size={16} />
          <h2 className="text-sm font-black truncate max-w-[200px] sm:max-w-xs">
            Edit: {media.filename}
          </h2>
          <span className="text-[9px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded uppercase">
            Save As Copy
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border/80 hover:bg-secondary text-xs font-semibold rounded-xl transition-all cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4.5 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-md active:scale-98"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save size={13} /> Save Copy
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-rose-500/10 rounded-xl hover:text-rose-500 transition-colors border border-transparent hover:border-rose-500/10 cursor-pointer ml-1"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. Interactive Workspace (Preview Side) */}
      <div className="flex-1 bg-black/40 flex items-center justify-center p-6 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-muted-foreground gap-2 animate-pulse">
            <Loader2 className="animate-spin text-primary" size={24} />
            LOADING PREVIEW...
          </div>
        )}

        <div 
          ref={containerRef}
          className="relative max-w-full max-h-[60vh] flex items-center justify-center"
        >
          {/* Main Visual Image Element */}
          <img
            ref={imageRef}
            src={media.url}
            onLoad={handleImageLoad}
            alt="Edit preview"
            className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl transition-all select-none pointer-events-none"
            style={{
              filter: `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%) sepia(${sepia}%) invert(${invert}%) saturate(${saturate}%) blur(${blur}px)`,
              transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
            }}
          />

          {/* Visual Crop Selection Box */}
          {cropActive && !loading && (
            <div 
              ref={cropBoxRef}
              onMouseDown={startDragBox}
              className="absolute border border-dashed border-primary bg-primary/10 shadow-2xl cursor-move select-none animate-in fade-in duration-100"
              style={{
                left: `${cropBox.x}%`,
                top: `${cropBox.y}%`,
                width: `${cropBox.w}%`,
                height: `${cropBox.h}%`,
              }}
            >
              {/* Corner Handles */}
              <div 
                onMouseDown={(e) => startResizeBox(e, "se")}
                className="absolute bottom-[-4px] right-[-4px] w-3 h-3 bg-primary rounded-full cursor-se-resize border border-white"
              />
              <div 
                onMouseDown={(e) => startResizeBox(e, "e")}
                className="absolute top-1/2 right-[-4px] w-2 h-4 bg-primary rounded cursor-e-resize border border-white -translate-y-1/2"
              />
              <div 
                onMouseDown={(e) => startResizeBox(e, "s")}
                className="absolute bottom-[-4px] left-1/2 w-4 h-2 bg-primary rounded cursor-s-resize border border-white -translate-x-1/2"
              />
              {/* Outer dimmed overlays */}
              <div className="absolute top-1 right-2 bg-black/75 backdrop-blur-sm border border-white/10 px-1.5 py-0.5 rounded text-[8px] font-bold text-white uppercase select-none pointer-events-none">
                Crop Region
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Controls Panel */}
      <div className="border-t border-border/60 bg-muted/20 pb-6 pt-3 px-4 sm:px-6 flex flex-col md:flex-row items-center gap-4 justify-between">
        {/* Navigation Mode */}
        <div className="flex gap-1.5 border border-border/40 p-1 rounded-xl bg-secondary/40 self-start md:self-auto">
          <button
            onClick={() => {
              setActiveTab("filters");
              setCropActive(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
              activeTab === "filters" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sliders size={13} /> Adjust Filters
          </button>
          <button
            onClick={() => {
              setActiveTab("crop");
              setCropActive(true);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
              activeTab === "crop" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CropIcon size={13} /> Crop & Resize
          </button>
          <button
            onClick={() => {
              setActiveTab("presets");
              setCropActive(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
              activeTab === "presets" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles size={13} /> Presets
          </button>
        </div>

        {/* Dynamic adjust tools base on active tab */}
        <div className="w-full md:flex-1 max-w-xl mx-auto">
          {activeTab === "filters" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold py-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>BRIGHTNESS</span>
                  <span>{brightness}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={150}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>CONTRAST</span>
                  <span>{contrast}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={150}
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>SATURATION</span>
                  <span>{saturate}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={saturate}
                  onChange={(e) => setSaturate(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>GRAYSCALE</span>
                  <span>{grayscale}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={grayscale}
                  onChange={(e) => setGrayscale(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>SEPIA</span>
                  <span>{sepia}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sepia}
                  onChange={(e) => setSepia(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>BLUR EFFECT</span>
                  <span>{blur}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={blur}
                  onChange={(e) => setBlur(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-secondary rounded"
                />
              </div>
            </div>
          )}

          {activeTab === "crop" && (
            <div className="flex flex-wrap items-center gap-4 justify-center py-2">
              {/* Presets */}
              <div className="flex gap-1 border border-border/40 p-0.5 rounded-lg bg-secondary/20 text-[10px] font-bold">
                <button
                  onClick={() => setAspectRatio(null)}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    aspectRatio === null ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Free
                </button>
                <button
                  onClick={() => setAspectRatio(1)}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    aspectRatio === 1 ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  1:1 (Square)
                </button>
                <button
                  onClick={() => setAspectRatio(16 / 9)}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    aspectRatio === 16 / 9 ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  16:9
                </button>
                <button
                  onClick={() => setAspectRatio(4 / 3)}
                  className={`px-2 py-1 rounded cursor-pointer ${
                    aspectRatio === 4 / 3 ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  4:3
                </button>
              </div>

              {/* Rotates & Flips */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="p-2 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Rotate Clockwise 90°"
                >
                  <RotateCw size={14} />
                </button>
                <button
                  onClick={() => setFlipH(!flipH)}
                  className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                    flipH ? "border-primary/45 bg-primary/10 text-primary" : "border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                  title="Flip Horizontal"
                >
                  <FlipHorizontal size={14} />
                </button>
                <button
                  onClick={() => setFlipV(!flipV)}
                  className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                    flipV ? "border-primary/45 bg-primary/10 text-primary" : "border-border hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                  title="Flip Vertical"
                >
                  <FlipVertical size={14} />
                </button>
              </div>
            </div>
          )}

          {activeTab === "presets" && (
            <div className="flex flex-wrap gap-2 justify-center py-2">
              {[
                { id: "vivid", label: "Vivid Glow" },
                { id: "noir", label: "Noir Monomask" },
                { id: "vintage", label: "Vintage Amber" },
                { id: "retro", label: "Warm Retro" },
                { id: "dramatic", label: "High Contrast" },
                { id: "cool", label: "Cool Saturation" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset.id)}
                  className="px-3.5 py-1.5 rounded-xl border border-border/80 hover:border-primary/40 bg-secondary/30 hover:bg-secondary/70 text-xs font-bold text-foreground cursor-pointer hover:shadow-sm transition-all text-center"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Help label */}
        <div className="hidden lg:block text-[9px] text-muted-foreground font-semibold max-w-[150px] leading-tight uppercase tracking-wider text-right shrink-0">
          Filters rendered dynamically. Saving generates a new copy.
        </div>
      </div>
    </div>
  );
}
