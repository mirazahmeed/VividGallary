import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { secureMediaUrls } from "@/lib/mediaUrl";
import sharp from "sharp";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const { imageDataUrl, filename } = await req.json();

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image data url" }, { status: 400 });
    }

    // Verify original media exists
    const originalMedia = await prisma.media.findUnique({
      where: { id, userId: session.userId },
      include: {
        albums: true,
      },
    });

    if (!originalMedia) {
      return NextResponse.json({ error: "Original media not found" }, { status: 404 });
    }

    // Decode base64 image data
    const base64Data = imageDataUrl.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");

    // Generate filename for the edited copy
    const fileExtension = imageDataUrl.split(";")[0].split("/")[1] || "jpg";
    const baseName = filename 
      ? filename.replace(/\.[^/.]+$/, "") 
      : originalMedia.filename.replace(/\.[^/.]+$/, "");
    
    const newFilename = `${baseName}_edited_${Date.now()}.${fileExtension}`;
    const mimeType = `image/${fileExtension}`;

    // Validate storage limits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const fileSize = buffer.length;
    if (user.storageUsed + fileSize > user.storageLimit) {
      return NextResponse.json(
        { error: "Storage limit exceeded. Cannot save edited image copy." },
        { status: 403 }
      );
    }

    // Upload edited file
    const fileUrl = await storage.upload(buffer, newFilename, mimeType);

    // Extract metadata & generate thumbnail
    let width = originalMedia.width || 1920;
    let height = originalMedia.height || 1080;
    let thumbnailUrl = fileUrl;

    try {
      const image = sharp(buffer);
      const meta = await image.metadata();
      width = meta.width || width;
      height = meta.height || height;

      // Generate thumbnail
      const thumbBuffer = await image
        .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      thumbnailUrl = await storage.upload(thumbBuffer, `thumb_${newFilename}`, "image/jpeg");
    } catch (err) {
      console.error("Failed to generate metadata/thumbnail for edited image:", err);
    }

    // Save edited media to database as a new resource
    const newMedia = await prisma.media.create({
      data: {
        filename: newFilename,
        type: "IMAGE",
        url: fileUrl,
        thumbnailUrl,
        size: fileSize,
        mimeType,
        width,
        height,
        visibility: originalMedia.visibility,
        userId: session.userId,
      },
    });

    // Auto-associate with the same albums as original
    if (originalMedia.albums.length > 0) {
      await Promise.all(
        originalMedia.albums.map((albumRelation) => {
          return prisma.mediaAlbum.create({
            data: {
              mediaId: newMedia.id,
              albumId: albumRelation.albumId,
            },
          });
        })
      );
    }

    // Update user storage used
    const updatedStorageUsed = user.storageUsed + fileSize;
    await prisma.user.update({
      where: { id: session.userId },
      data: { storageUsed: updatedStorageUsed },
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "MEDIA_EDIT_SAVE",
        details: `Saved edited copy of media ID ${id} as a new file: ${newFilename}`,
      },
    });

    const securedMedia = secureMediaUrls([newMedia], session.userId)[0];
    return NextResponse.json({ success: true, media: securedMedia });
  } catch (error: any) {
    console.error("Edit save error:", error);
    return NextResponse.json(
      { error: "Failed to save edited copy", details: error?.message },
      { status: 500 }
    );
  }
}
