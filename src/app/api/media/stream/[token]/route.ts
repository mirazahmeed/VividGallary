import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyStreamToken } from "@/lib/mediaToken";
import { getFilePath } from "@/lib/storage";
import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Secure Media Stream Endpoint
 * 
 * Serves media files through a signed, time-limited token system.
 * Validates: token signature, token expiry, session cookie, and referer header.
 * 
 * Performance: Uses ETag + If-None-Match for 304 caching to avoid
 * re-sending unchanged files. Images get 10-min cache with stale-while-revalidate.
 */

/**
 * Generate ETag from file stats (mtime + size).
 * This is fast (no file read needed) and changes when the file is modified.
 */
function generateETag(stats: fs.Stats): string {
  const hash = crypto
    .createHash("md5")
    .update(`${stats.mtimeMs}-${stats.size}`)
    .digest("hex")
    .slice(0, 16);
  return `"${hash}"`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Verify the signed stream token
    const payload = verifyStreamToken(token);
    if (!payload) {
      return new NextResponse("Access denied — invalid or expired media token", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 2. Validate session cookie (authenticated user required)
    //    Exception: share page requests may not have a session,
    //    so we allow if the token's userId is "share-guest"
    const session = await getSession();
    const isShareGuest = payload.userId === "share-guest";

    if (!session && !isShareGuest) {
      return new NextResponse("Access denied — authentication required", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 3. Check Referer/Origin header — must be from same origin
    const referer = req.headers.get("referer") || "";
    const origin = req.headers.get("origin") || "";
    const host = req.headers.get("host") || "localhost";

    const isSameOriginReferer = referer === "" || referer.includes(host);
    const isSameOriginOrigin = origin === "" || origin.includes(host);

    if (!isSameOriginReferer && !isSameOriginOrigin) {
      return new NextResponse("Access denied — cross-origin request blocked", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 4. Detect and block known download manager User-Agents
    const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
    const blockedAgents = [
      "idm", "internet download manager", "wget", "curl",
      "jdownloader", "flashget", "getright", "download master",
      "freedownloadmanager", "fdm", "eagleget", "aria2",
      "axel", "uget", "persepolis",
    ];
    if (blockedAgents.some((agent) => userAgent.includes(agent))) {
      return new NextResponse("Access denied — automated downloads blocked", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 5. Resolve file on disk
    const filePath = getFilePath(payload.mediaUrl);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("Media file not found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 6. Get file stats and generate ETag
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const etag = generateETag(stats);

    // 7. Check If-None-Match for 304 response (skip file read entirely)
    const ifNoneMatch = req.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": "private, max-age=600, stale-while-revalidate=1200",
        },
      });
    }

    // 8. Determine MIME type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/mp4",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    const isImage = contentType.startsWith("image/");

    // 9. Cache-Control: images get longer cache, videos get token-bound cache
    const currentEpoch = Math.floor(Date.now() / 1000);
    const tokenMaxAge = Math.max(0, payload.exp - currentEpoch);
    const cacheControl = isImage
      ? "private, max-age=600, stale-while-revalidate=1200"
      : (tokenMaxAge > 0
          ? `private, max-age=${Math.min(tokenMaxAge, 300)}`
          : "private, no-store, no-cache, must-revalidate");

    // Shared security headers
    const securityHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cacheControl,
      "ETag": etag,
      "X-Robots-Tag": "noindex, nofollow",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "same-origin",
    };

    // 10. Handle Range requests for video seeking support
    const range = req.headers.get("range");

    if (range && contentType.startsWith("video/")) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new NextResponse("Requested range not satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = fs.createReadStream(filePath, { start, end });
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on("data", (chunk) => {
            const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
            controller.enqueue(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
          });
          nodeStream.on("end", () => {
            controller.close();
          });
          nodeStream.on("error", (err) => {
            controller.error(err);
          });
        },
        cancel() {
          nodeStream.destroy();
        }
      });

      return new NextResponse(webStream as any, {
        status: 206,
        headers: {
          ...securityHeaders,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunkSize.toString(),
          "Accept-Ranges": "bytes",
        },
      });
    }

    // 11. Stream full file
    const nodeStream = fs.createReadStream(filePath);
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => {
          const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
        });
        nodeStream.on("end", () => {
          controller.close();
        });
        nodeStream.on("error", (err) => {
          controller.error(err);
        });
      },
      cancel() {
        nodeStream.destroy();
      }
    });

    return new NextResponse(webStream as any, {
      status: 200,
      headers: {
        ...securityHeaders,
        "Content-Length": fileSize.toString(),
      },
    });
  } catch (error) {
    console.error("Secure stream error:", error);
    return new NextResponse("Internal server error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
