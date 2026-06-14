import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js Middleware — blocks direct access to /uploads/* paths.
 * 
 * Since media files have been moved out of public/, this path should never
 * be served statically. This middleware acts as an extra safety net to ensure
 * any direct URL to /uploads/... returns a 403 Forbidden response.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Block any direct request to /uploads/* (the old public static path)
  if (pathname.startsWith("/uploads/") || pathname === "/uploads") {
    // Allow avatars to be accessed directly (which starts with avatar- or avatar_)
    const filename = pathname.replace("/uploads/", "");
    if (filename.startsWith("avatar-") || filename.startsWith("avatar_")) {
      return NextResponse.next();
    }

    return new NextResponse(
      JSON.stringify({
        error: "Direct media access is forbidden. Use the application to view media.",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  }

  return NextResponse.next();
}

// Only run middleware on /uploads/* paths to avoid performance overhead
export const config = {
  matcher: ["/uploads/:path*"],
};
