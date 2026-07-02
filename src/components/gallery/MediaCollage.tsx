import React from "react";
import NextImage from "next/image";
import FeedVideoPlayer from "./FeedVideoPlayer";

interface MediaCollageProps {
  media: any[];
  onMediaClick: (index: number, list: any[]) => void;
  onSeeAllClick?: (list: any[]) => void;
}

/**
 * Renders a single media cell — image uses NextImage, video uses FeedVideoPlayer
 * with inline autoplay when scrolled into viewport.
 */
function MediaCell({
  item,
  index,
  media,
  onMediaClick,
  className = "",
}: {
  item: any;
  index: number;
  media: any[];
  onMediaClick: (idx: number, list: any[]) => void;
  className?: string;
}) {
  if (item.type === "VIDEO") {
    return (
      <FeedVideoPlayer
        src={item.url}
        poster={item.thumbnailUrl}
        className={className}
        onClick={() => onMediaClick(index, media)}
      />
    );
  }

  return (
    <div
      className={`relative cursor-pointer h-full group bg-black/40 ${className}`}
      onClick={() => onMediaClick(index, media)}
    >
      <NextImage src={item.url} fill unoptimized className="object-cover" alt="" />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <span className="text-[9px] bg-primary text-primary-foreground font-bold px-2.5 py-1.5 rounded-lg shadow-md">
          Open
        </span>
      </div>
    </div>
  );
}

export default function MediaCollage({
  media,
  onMediaClick,
  onSeeAllClick
}: MediaCollageProps) {
  if (!media || media.length === 0) return null;

  const count = media.length;
  if (count === 1) {
    const item = media[0];
    if (item.type === "VIDEO") {
      return (
        <FeedVideoPlayer
          src={item.url}
          poster={item.thumbnailUrl}
          className="rounded-2xl border border-border/50 aspect-[16/9]"
          onClick={() => onMediaClick(0, media)}
        />
      );
    }
    return (
      <div
        className="rounded-2xl border border-border/50 overflow-hidden bg-black/40 aspect-[16/9] relative cursor-pointer group hover:scale-[1.005] active:scale-[0.995] transition-all"
        onClick={() => onMediaClick(0, media)}
      >
        <NextImage src={item.url} fill unoptimized className="object-cover" alt="" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <span className="text-[10px] bg-primary text-primary-foreground font-black px-3 py-1.5 rounded-xl shadow-lg">
            Open in Lightbox
          </span>
        </div>
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden border border-border/50 aspect-[16/10]">
        {media.map((item, idx) => (
          <MediaCell
            key={item.id}
            item={item}
            index={idx}
            media={media}
            onMediaClick={onMediaClick}
            className="h-full"
          />
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden border border-border/50 aspect-[16/10] bg-black/10">
        <div className="col-span-2 relative overflow-hidden">
          <MediaCell
            item={media[0]}
            index={0}
            media={media}
            onMediaClick={onMediaClick}
            className="h-full"
          />
        </div>
        <div className="col-span-1 grid grid-rows-2 gap-1.5 h-full">
          {media.slice(1, 3).map((item, idx) => (
            <MediaCell
              key={item.id}
              item={item}
              index={idx + 1}
              media={media}
              onMediaClick={onMediaClick}
              className="h-full"
            />
          ))}
        </div>
      </div>
    );
  }

  if (count === 4) {
    return (
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl overflow-hidden border border-border/50 aspect-[16/10] bg-black/10">
        <div className="col-span-2 relative overflow-hidden">
          <MediaCell
            item={media[0]}
            index={0}
            media={media}
            onMediaClick={onMediaClick}
            className="h-full"
          />
        </div>
        <div className="col-span-2 grid grid-rows-3 gap-1.5 h-full">
          {media.slice(1, 4).map((item, idx) => (
            <MediaCell
              key={item.id}
              item={item}
              index={idx + 1}
              media={media}
              onMediaClick={onMediaClick}
              className="h-full"
            />
          ))}
        </div>
      </div>
    );
  }

  // 5 or more items (collage style: Left has 2 rows, Right has 3 rows)
  const remaining = count - 5;
  return (
    <div className="flex gap-1.5 rounded-2xl overflow-hidden border border-border/50 aspect-[16/14] bg-black/10 w-full">
      {/* Left Column (2 images) */}
      <div className="flex flex-col gap-1.5 w-1/2 h-full">
        {/* Image 1 (index 0) */}
        <div className="relative flex-1 overflow-hidden">
          <MediaCell
            item={media[0]}
            index={0}
            media={media}
            onMediaClick={onMediaClick}
            className="h-full"
          />
        </div>
        {/* Image 4 (index 3) */}
        <div className="relative flex-1 overflow-hidden">
          <MediaCell
            item={media[3]}
            index={3}
            media={media}
            onMediaClick={onMediaClick}
            className="h-full"
          />
        </div>
      </div>

      {/* Right Column (3 images) */}
      <div className="flex flex-col gap-1.5 w-1/2 h-full">
        {/* Image 2 (index 1) */}
        <div className="relative flex-1 overflow-hidden">
          <MediaCell
            item={media[1]}
            index={1}
            media={media}
            onMediaClick={onMediaClick}
            className="h-full"
          />
        </div>
        {/* Image 3 (index 2) */}
        <div className="relative flex-1 overflow-hidden">
          <MediaCell
            item={media[2]}
            index={2}
            media={media}
            onMediaClick={onMediaClick}
            className="h-full"
          />
        </div>
        {/* Image 5 (index 4) (with optional overlay) */}
        <div
          className="relative flex-1 cursor-pointer group bg-black/40 overflow-hidden"
          onClick={() => {
            if (remaining > 0 && onSeeAllClick) {
              onSeeAllClick(media);
            } else {
              onMediaClick(4, media);
            }
          }}
        >
          {media[4].type === "VIDEO" ? (
            <video src={media[4].url} className="w-full h-full object-cover" muted preload="metadata" />
          ) : (
            <NextImage src={media[4].url} fill unoptimized className="object-cover" alt="" />
          )}
          {remaining > 0 ? (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-extrabold text-lg sm:text-2xl select-none group-hover:bg-black/70 transition-colors">
              +{remaining}
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <span className="text-[8px] bg-primary text-primary-foreground font-bold px-2 py-1 rounded">
                Open
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
