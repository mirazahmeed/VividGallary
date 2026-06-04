import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyStreamToken } from "@/lib/mediaToken";
import { getFilePath } from "@/lib/storage";
import fs from "fs";
import path from "path";

/**
 * Secure Media Stream Endpoint
 * 
 * Serves media files through a signed, time-limited token system.
 * Validates: token signature, token expiry, session cookie, and referer header.
 * 
 * This prevents third-party download managers (IDM, JDownloader, etc.) from
 * grabbing media because:
 * 1. URLs expire after 5 minutes
 * 2. Requests without a valid session cookie are rejected
 * 3. Requests from external referers are rejected
 * 4. Anti-download headers prevent browser download prompts
 */
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

    // 6. Determine MIME type from extension
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
      ".mov": "video/quicktime",
      ".mkv": "video/x-matroska",
      ".avi": "video/x-msvideo",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    // 7. Read file and stream with protective headers
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fileBuffer.length;

    // Handle Range requests for video seeking support
    const range = req.headers.get("range");

    if (range && contentType.startsWith("video/")) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const chunk = fileBuffer.subarray(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunkSize.toString(),
          "Accept-Ranges": "bytes",
          // Security headers
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
          "X-Robots-Tag": "noindex, nofollow",
          "X-Frame-Options": "SAMEORIGIN",
          "Referrer-Policy": "same-origin",
        },
      });
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileSize.toString(),
        // Security: Force inline display, never trigger download dialog
        "Content-Disposition": "inline",
        // Prevent MIME type sniffing
        "X-Content-Type-Options": "nosniff",
        // Prevent caching of media URLs
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        // Prevent search engine indexing of media
        "X-Robots-Tag": "noindex, nofollow",
        // Prevent embedding in iframes from other origins
        "X-Frame-Options": "SAMEORIGIN",
        // Prevent referer leaking to other origins
        "Referrer-Policy": "same-origin",
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
