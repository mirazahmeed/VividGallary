import { generateStreamToken } from "./mediaToken";

/**
 * Replaces raw media URLs (url, thumbnailUrl) with signed stream URLs
 * throughout a media items array. Handles nested structures like
 * album.media[].media.url and playlist.items[].media.url.
 */
export function secureMediaUrls(items: any[], userId: string): any[] {
  return items.map((item) => secureMediaItem(item, userId));
}

/**
 * Secures a single media item's URLs.
 */
export function secureMediaItem(item: any, userId: string): any {
  if (!item) return item;
  const secured = { ...item };

  // Direct media fields
  if (secured.url && typeof secured.url === "string") {
    secured.url = toStreamUrl(secured.url, userId);
  }
  if (secured.thumbnailUrl && typeof secured.thumbnailUrl === "string") {
    secured.thumbnailUrl = toStreamUrl(secured.thumbnailUrl, userId);
  }
  if (secured.gridThumbUrl && typeof secured.gridThumbUrl === "string") {
    secured.gridThumbUrl = toStreamUrl(secured.gridThumbUrl, userId);
  }

  // Nested: album.media[].media or direct media[] arrays with .media subfield
  if (Array.isArray(secured.media)) {
    secured.media = secured.media.map((m: any) => {
      if (m && m.media) {
        return { ...m, media: secureMediaItem(m.media, userId) };
      }
      return secureMediaItem(m, userId);
    });
  }

  // Nested: coverMedia
  if (secured.coverMedia) {
    secured.coverMedia = secureMediaItem(secured.coverMedia, userId);
  }

  // Nested: children (sub-albums)
  if (Array.isArray(secured.children)) {
    secured.children = secured.children.map((child: any) =>
      secureMediaItem(child, userId)
    );
  }

  // Nested: playlist items
  if (Array.isArray(secured.items)) {
    secured.items = secured.items.map((playlistItem: any) => {
      if (playlistItem && playlistItem.media) {
        return { ...playlistItem, media: secureMediaItem(playlistItem.media, userId) };
      }
      return playlistItem;
    });
  }

  // Nested: album, playlist (for share access responses)
  if (secured.album) {
    secured.album = secureMediaItem(secured.album, userId);
  }
  if (secured.playlist) {
    secured.playlist = secureMediaItem(secured.playlist, userId);
  }

  return secured;
}

/**
 * Converts a raw file URL (e.g. /uploads/file.jpg) into a signed stream URL.
 * Only converts local upload paths — external URLs (S3, etc.) are left as-is.
 */
function toStreamUrl(rawUrl: string, userId: string): string {
  // Only transform local upload paths
  if (!rawUrl.startsWith("/uploads/")) {
    return rawUrl;
  }
  const token = generateStreamToken(rawUrl, userId);
  return `/api/media/stream/${token}`;
}
