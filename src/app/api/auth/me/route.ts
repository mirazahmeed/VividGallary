import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        bio: true,
        storageLimit: true,
        storageUsed: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Dynamic stats aggregation for the profile panel
    const mediaCount = await prisma.media.count({
      where: { userId: user.id, inTrash: false },
    });

    const photosCount = await prisma.media.count({
      where: { userId: user.id, type: "IMAGE", inTrash: false },
    });

    const videosCount = await prisma.media.count({
      where: { userId: user.id, type: "VIDEO", inTrash: false },
    });

    const albumsCount = await prisma.album.count({
      where: { userId: user.id },
    });

    const playlistsCount = await prisma.playlist.count({
      where: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        stats: {
          mediaCount,
          photosCount,
          videosCount,
          albumsCount,
          playlistsCount,
        },
      },
    });
  } catch (error) {
    console.error("Profile retrieval error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user session" },
      { status: 500 }
    );
  }
}
