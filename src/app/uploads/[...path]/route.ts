import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const relativePath = path.join(...pathSegments);

    // Prevent directory traversal attacks
    const resolvedPath = path.resolve(process.cwd(), "storage", "uploads", relativePath);
    const uploadDir = path.resolve(process.cwd(), "storage", "uploads");
    if (!resolvedPath.startsWith(uploadDir)) {
      return new NextResponse("Access denied", { status: 403 });
    }

    const filename = pathSegments[pathSegments.length - 1] || "";

    // Enforce that only avatars can be accessed directly
    const isAvatar = filename.startsWith("avatar-") || filename.startsWith("avatar_") || pathSegments.includes("avatar");
    if (!isAvatar) {
      return new NextResponse(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const filePath = resolvedPath;

    if (!fs.existsSync(filePath)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving avatar:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
