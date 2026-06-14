import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { getOrCreateDefaultAlbum } from "@/lib/defaultAlbum";

// POST: Add media to album
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: albumId } = await params;
    const { mediaIds } = await req.json();

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json({ error: "No media IDs provided" }, { status: 400 });
    }

    // Verify album exists and user is owner or editor/contributor
    const album = await prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const isOwner = album.userId === session.userId;
    const collaborator = await prisma.permission.findFirst({
      where: { albumId, userId: session.userId, role: { in: ["EDITOR", "CONTRIBUTOR"] } },
    });

    if (!isOwner && !collaborator) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Add media items (ignoring duplicates)
    const addedItems = [];
    const targetMediaVisibility = album.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
    
    for (const mediaId of mediaIds) {
      try {
        const joint = await prisma.mediaAlbum.create({
          data: { mediaId, albumId },
        });
        addedItems.push(joint);

        // Sync media visibility with album visibility
        await prisma.media.update({
          where: { id: mediaId },
          data: { visibility: targetMediaVisibility },
        });
      } catch {
        // Ignore duplicate key constraints
      }
    }

    // If adding to a non-default album, remove from default "Random Media" album
    if (!album.isDefault && addedItems.length > 0) {
      const defaultAlbum = await getOrCreateDefaultAlbum(session.userId);
      await prisma.mediaAlbum.deleteMany({
        where: {
          albumId: defaultAlbum.id,
          mediaId: { in: addedItems.map(item => item.mediaId) },
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_ADD_MEDIA",
        details: `Added ${addedItems.length} items to Album "${album.name}"`,
      },
    });

    return NextResponse.json({ success: true, count: addedItems.length });
  } catch (error) {
    console.error("Album media add error:", error);
    return NextResponse.json(
      { error: "Failed to add items to album" },
      { status: 500 }
    );
  }
}

// DELETE: Remove media from album (permanently deletes the media from gallery/storage)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: albumId } = await params;
    const { mediaIds } = await req.json();

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json({ error: "No media IDs provided" }, { status: 400 });
    }

    // Verify album ownership / permission
    const album = await prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    const isOwner = album.userId === session.userId;
    const collaborator = await prisma.permission.findFirst({
      where: { albumId, userId: session.userId, role: { in: ["EDITOR", "CONTRIBUTOR"] } },
    });

    if (!isOwner && !collaborator) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch files to delete from storage and recalculate space
    // Only fetch media that are actually in this album
    const files = await prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        userId: session.userId,
        albums: {
          some: {
            albumId: albumId
          }
        }
      },
    });

    if (files.length === 0) {
      return NextResponse.json({ error: "No media found to delete" }, { status: 404 });
    }

    let totalDeletedSize = 0;

    // Delete files from storage
    await Promise.all(
      files.map(async (file: any) => {
        try {
          await storage.delete(file.url);
          if (file.thumbnailUrl && file.thumbnailUrl !== file.url) {
            await storage.delete(file.thumbnailUrl);
          }
        } catch (storageErr) {
          console.error(`Failed to delete storage file for media ${file.id}:`, storageErr);
        }
        totalDeletedSize += file.size;
      })
    );

    // Delete from DB (cascade cleans up MediaAlbum and other relations)
    await prisma.media.deleteMany({
      where: {
        id: { in: files.map((f: any) => f.id) },
      },
    });

    // Update user's storage limits
    const updatedUser = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    
    if (updatedUser) {
      const newStorageUsed = Math.max(0, updatedUser.storageUsed - totalDeletedSize);
      await prisma.user.update({
        where: { id: session.userId },
        data: { storageUsed: newStorageUsed },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_REMOVE_MEDIA",
        details: `Permanently deleted ${files.length} items from Album "${album.name}"`,
      },
    });

    return NextResponse.json({ success: true, count: files.length });
  } catch (error) {
    console.error("Album media remove error:", error);
    return NextResponse.json(
      { error: "Failed to remove items from album" },
      { status: 500 }
    );
  }
}
