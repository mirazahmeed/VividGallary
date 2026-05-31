import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            media: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    if (playlist.userId !== session.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ success: true, playlist });
  } catch (error) {
    console.error("Playlist detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlist details" },
      { status: 500 }
    );
  }
}

// Update playlist details and/or update ordered list items (for drag-and-drop backend sorting)
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
    const { name, description, category, autoPlay, speed, mediaIds } = await req.json();

    const playlist = await prisma.playlist.findUnique({
      where: { id },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    if (playlist.userId !== session.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (autoPlay !== undefined) updateData.autoPlay = autoPlay;
    if (speed !== undefined) updateData.speed = speed;

    // Use transaction to update metadata and/or re-order items
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Update basic settings
      const updatedPlaylist = await tx.playlist.update({
        where: { id },
        data: updateData,
      });

      // 2. If an array of mediaIds is provided, replace the playlist item list to apply new sorting order
      if (mediaIds && Array.isArray(mediaIds)) {
        // Clear current items
        await tx.playlistItem.deleteMany({
          where: { playlistId: id },
        });

        // Insert new items in the requested order
        const playlistItemsData = mediaIds.map((mediaId, index) => ({
          playlistId: id,
          mediaId,
          order: index,
        }));

        // Loop to insert to avoid composite unique constraints collisions
        for (const item of playlistItemsData) {
          await tx.playlistItem.create({
            data: item,
          });
        }
      }

      return updatedPlaylist;
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "PLAYLIST_UPDATE",
        details: `Updated playlist settings / item order for "${result.name}"`,
      },
    });

    return NextResponse.json({ success: true, playlist: result });
  } catch (error) {
    console.error("Playlist edit error:", error);
    return NextResponse.json(
      { error: "Failed to update playlist" },
      { status: 500 }
    );
  }
}

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

    const playlist = await prisma.playlist.findUnique({
      where: { id },
    });

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    if (playlist.userId !== session.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await prisma.playlist.delete({
      where: { id },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "PLAYLIST_DELETE",
        details: `Deleted playlist "${playlist.name}"`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Playlist delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete playlist" },
      { status: 500 }
    );
  }
}
