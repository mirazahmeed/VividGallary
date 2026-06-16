import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureMediaUrls } from "@/lib/mediaUrl";
import { storage } from "@/lib/storage";

// GET a specific media file details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const media = await prisma.media.findUnique({
      where: { id, userId: session.userId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        likes: true,
      },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const securedMedia = secureMediaUrls([media], session.userId)[0];
    return NextResponse.json({ success: true, media: securedMedia });
  } catch (error) {
    console.error("Fetch single media error:", error);
    return NextResponse.json(
      { error: "Failed to fetch media details" },
      { status: 500 }
    );
  }
}

// PUT (update) a specific media file (rename filename and edit tags)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { filename, tags, visibility, isFavorite } = body;

    // Verify ownership
    const media = await prisma.media.findUnique({
      where: { id, userId: session.userId },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found or unauthorized" }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof filename === "string") {
      updateData.filename = filename.trim();
    }
    if (typeof visibility === "string") {
      updateData.visibility = visibility;
    }
    if (typeof isFavorite === "boolean") {
      updateData.isFavorite = isFavorite;
    }

    // Process tag changes if tags array is provided
    if (Array.isArray(tags)) {
      // Clean and normalize tags
      const cleanTags = tags
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.length > 0);

      // Create tag records if they don't exist
      const tagRecords = await Promise.all(
        cleanTags.map(async (name: string) => {
          return prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          });
        })
      );

      // Remove existing tag associations
      await prisma.mediaTag.deleteMany({
        where: { mediaId: id },
      });

      // Add new associations
      if (tagRecords.length > 0) {
        await prisma.mediaTag.createMany({
          data: tagRecords.map((tag) => ({
            mediaId: id,
            tagId: tag.id,
          })),
        });
      }
    }

    // Perform database update
    const updatedMedia = await prisma.media.update({
      where: { id },
      data: updateData,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        likes: true,
      },
    });

    // Log update action
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "MEDIA_UPDATE",
        details: `Updated details for media ID ${id}: ${filename || "metadata"}`,
      },
    });

    const securedMedia = secureMediaUrls([updatedMedia], session.userId)[0];
    return NextResponse.json({ success: true, media: securedMedia });
  } catch (error) {
    console.error("Update media error:", error);
    return NextResponse.json(
      { error: "Failed to update media" },
      { status: 500 }
    );
  }
}

// DELETE: Permanently delete a single media item from everywhere
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch file details for storage cleanup
    const media = await prisma.media.findUnique({
      where: { id, userId: session.userId },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found or unauthorized" }, { status: 404 });
    }

    // 1. Delete from physical storage
    try {
      await storage.delete(media.url);
      if (media.thumbnailUrl && media.thumbnailUrl !== media.url) {
        await storage.delete(media.thumbnailUrl);
      }
    } catch (storageErr) {
      console.error(`Failed to delete storage file for media ${id}:`, storageErr);
    }

    // 2. Delete from database (cascade removes MediaAlbum, PlaylistItem, MediaTag, Comment, Like, Share; Post/Message get mediaId set to null)
    await prisma.media.delete({
      where: { id },
    });

    // 3. Recalculate user storage
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (user) {
      const newStorageUsed = Math.max(0, user.storageUsed - media.size);
      await prisma.user.update({
        where: { id: session.userId },
        data: { storageUsed: newStorageUsed },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "MEDIA_PERMANENT_DELETE",
        details: `Permanently deleted "${media.filename}" from everywhere (freed ${(media.size / 1024 / 1024).toFixed(2)} MB)`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Single media delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete media" },
      { status: 500 }
    );
  }
}
