import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getOrCreateDefaultAlbum } from "@/lib/defaultAlbum";
import sharp from "sharp";

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
      let metadataJson: string | null = null;
      let thumbnailUrl = fileUrl;

      if (type === "VIDEO") {
        duration = 12.4; // Mock standard video duration for display preview
        resolution = "1080p";
      } else {
        try {
          const image = sharp(buffer);
          const imageMeta = await image.metadata();
          width = imageMeta.width || 1920;
          height = imageMeta.height || 1080;

          // Parse EXIF
          let exifData: any = {};
          if (imageMeta.exif) {
            try {
              const exifReader = require("exif-reader");
              exifData = exifReader(imageMeta.exif);
            } catch (e) {
              console.error("Failed to parse EXIF:", e);
            }
          }

          const exifInfo = {
            camera: exifData.image?.Model || null,
            lens: exifData.exif?.LensModel || null,
            aperture: exifData.exif?.FNumber ? `f/${exifData.exif.FNumber}` : null,
            iso: exifData.exif?.ISO || null,
            shutterSpeed: exifData.exif?.ExposureTime ? `1/${Math.round(1 / exifData.exif.ExposureTime)}s` : null,
            focalLength: exifData.exif?.FocalLength ? `${exifData.exif.FocalLength}mm` : null,
            gps: exifData.gps?.GPSLatitude && exifData.gps?.GPSLongitude ? {
              lat: exifData.gps.GPSLatitude[0] + exifData.gps.GPSLatitude[1]/60 + exifData.gps.GPSLatitude[2]/3600,
              lng: exifData.gps.GPSLongitude[0] + exifData.gps.GPSLongitude[1]/60 + exifData.gps.GPSLongitude[2]/3600,
            } : null,
          };

          metadataJson = JSON.stringify(exifInfo);

          // Generate thumbnail (max 600px width/height)
          const thumbBuffer = await image
            .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

          thumbnailUrl = await storage.upload(thumbBuffer, `thumb_${filename}.jpg`, "image/jpeg");
        } catch (err) {
          console.error("Error extracting metadata or thumbnail:", err);
        }
      }

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
          metadata: metadataJson,
          userId: session.userId,
        },
      });

      // If albumId was provided, add file to that album and sync visibility
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
      } else {
        // No album selected — auto-assign to the "Random Media" default album
        const defaultAlbum = await getOrCreateDefaultAlbum(session.userId);
        await prisma.mediaAlbum.create({
          data: {
            mediaId: media.id,
            albumId: defaultAlbum.id,
          },
        });
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
  } catch (error: any) {
    console.error("Upload handler error:", error);
    try {
      const fs = require("fs");
      const path = require("path");
      fs.writeFileSync(
        path.join(process.cwd(), "upload-error.txt"),
        `Error: ${error?.message}\nStack: ${error?.stack || error}`
      );
    } catch (e) {
      console.error("Failed to write error log", e);
    }
    return NextResponse.json(
      { error: "Upload processing failed", details: error?.message, stack: error?.stack },
      { status: 500 }
    );
  }
}
