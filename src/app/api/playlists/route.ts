import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const playlists = await prisma.playlist.findMany({
      where: { userId: session.userId },
      include: {
        _count: {
          select: {
            items: true,
          },
        },
        items: {
          take: 1,
          include: {
            media: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, playlists });
  } catch (error) {
    console.error("Playlists fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlists" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { name, description, category, autoPlay, speed } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Playlist name is required" }, { status: 400 });
    }

    const playlist = await prisma.playlist.create({
      data: {
        name,
        description,
        category,
        autoPlay: autoPlay !== undefined ? autoPlay : true,
        speed: speed || 3,
        userId: session.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "PLAYLIST_CREATE",
        details: `Created playlist "${name}"`,
      },
    });

    return NextResponse.json({ success: true, playlist });
  } catch (error) {
    console.error("Playlist creation error:", error);
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}
