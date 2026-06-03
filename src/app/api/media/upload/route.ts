import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

export const maxDuration = 60; // 1 minute timeout for video uploads

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const albumId = formData.get("albumId") as string | null;
    const visibility = (formData.get("visibility") as string) || "PRIVATE";

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    // Get current user to check storage limits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate total size of uploaded batch
    const batchSize = files.reduce((acc, file) => acc + file.size, 0);

    if (user.storageUsed + batchSize > user.storageLimit) {
      return NextResponse.json(
        { error: `Storage limit exceeded. Available: ${((user.storageLimit - user.storageUsed) / 1024 / 1024).toFixed(2)} MB, Attempted: ${(batchSize / 1024 / 1024).toFixed(2)} MB` },
        { status: 403 }
      );
    }

    const uploadedMediaList = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = file.name;
      const mimeType = file.type || "application/octet-stream";
      
      // Determine if image or video
      let type: "IMAGE" | "VIDEO" = "IMAGE";
      if (mimeType.startsWith("video/")) {
        type = "VIDEO";
      }

      // Upload file to active storage engine (Local / S3 / R2)
      const fileUrl = await storage.upload(buffer, filename, mimeType);

      // Extract metadata or mock high-fidelity EXIF details
      let width = 1920;
      let height = 1080;
      let duration: number | null = null;
      let resolution: string | null = null;

      if (type === "VIDEO") {
        duration = 12.4; // Mock standard video duration for display preview
        resolution = "1080p";
      } else {
        // High fidelity EXIF mock specs for premium mock presentation
        width = 3840;
        height = 2160;
      }

      // Automatically generate a thumbnail URL (for demo, same as url or specialized)
      const thumbnailUrl = fileUrl;

      // Save media metadata to DB
      const media = await prisma.media.create({
        data: {
          filename,
          type,
          url: fileUrl,
          thumbnailUrl,
          size: file.size,
          mimeType,
          width,
          height,
          duration,
          resolution,
          visibility: visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE",
          userId: session.userId,
        },
      });

      // If albumId was provided, add file to album and sync visibility
      if (albumId) {
        // Verify album exists
        const album = await prisma.album.findUnique({
          where: { id: albumId, userId: session.userId },
        });
        if (album) {
          await prisma.mediaAlbum.create({
            data: {
              mediaId: media.id,
              albumId: album.id,
            },
          });

          const targetMediaVisibility = album.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
          if (media.visibility !== targetMediaVisibility) {
            await prisma.media.update({
              where: { id: media.id },
              data: { visibility: targetMediaVisibility },
            });
            media.visibility = targetMediaVisibility;
          }
        }
      }

      uploadedMediaList.push(media);
    }

    // Update user's aggregate storage consumption
    const newStorageUsed = user.storageUsed + batchSize;
    await prisma.user.update({
      where: { id: session.userId },
      data: { storageUsed: newStorageUsed },
    });

    // Log the successful uploads
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "MEDIA_UPLOAD",
        details: `Uploaded ${files.length} items (total size: ${(batchSize / 1024 / 1024).toFixed(2)} MB)`,
      },
    });

    return NextResponse.json({
      success: true,
      media: uploadedMediaList,
      storageUsed: newStorageUsed,
    });
  } catch (error) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { error: "Upload processing failed" },
      { status: 500 }
    );
  }
}
