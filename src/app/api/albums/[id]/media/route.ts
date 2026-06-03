import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

// DELETE: Remove media from album
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

    // Perform deletions
    const deleteCount = await prisma.mediaAlbum.deleteMany({
      where: {
        albumId,
        mediaId: { in: mediaIds },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_REMOVE_MEDIA",
        details: `Removed ${deleteCount.count} items from Album "${album.name}"`,
      },
    });

    return NextResponse.json({ success: true, count: deleteCount.count });
  } catch (error) {
    console.error("Album media remove error:", error);
    return NextResponse.json(
      { error: "Failed to remove items from album" },
      { status: 500 }
    );
  }
}
