import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get user's own albums AND collaborative albums they are a member of
    const ownedAlbums = await prisma.album.findMany({
      where: {
        OR: [
          { userId: session.userId },
          {
            permissions: {
              some: {
                userId: session.userId,
              },
            },
          },
        ],
      },
      include: {
        coverMedia: true,
        media: {
          where: {
            media: {
              inTrash: false,
            },
          },
          orderBy: {
            addedAt: "asc",
          },
          include: {
            media: {
              select: {
                url: true,
              },
            },
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Map each album to resolve the first picture as coverMedia if coverMediaId is null
    const albumsWithCovers = ownedAlbums.map((album) => {
      let resolvedCoverMedia = album.coverMedia;
      if (!resolvedCoverMedia && album.media.length > 0) {
        resolvedCoverMedia = {
          url: album.media[0].media.url,
        } as any;
      }
      
      const mediaCount = album.media.length;
      // Remove the extra media field to keep payload clean
      const { media, ...rest } = album;
      return {
        ...rest,
        coverMedia: resolvedCoverMedia,
        _count: {
          media: mediaCount,
        },
      };
    });

    return NextResponse.json({ success: true, albums: albumsWithCovers });
  } catch (error) {
    console.error("Albums fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch albums" },
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

    const { name, description, visibility, password, parentId } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Album name is required" }, { status: 400 });
    }

    let passwordHash: string | null = null;
    if (visibility === "PASSWORD_PROTECTED" && password) {
      passwordHash = hashPassword(password);
    }

    // Verify parent album ownership if creating nested album
    if (parentId) {
      const parentAlbum = await prisma.album.findUnique({
        where: { id: parentId, userId: session.userId },
      });
      if (!parentAlbum) {
        return NextResponse.json({ error: "Parent album not found or unauthorized" }, { status: 404 });
      }
    }

    const album = await prisma.album.create({
      data: {
        name,
        description,
        visibility: visibility || "PRIVATE",
        passwordHash,
        parentId,
        userId: session.userId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_CREATE",
        details: `Created album "${name}" (visibility: ${visibility || "PRIVATE"})`,
      },
    });

    return NextResponse.json({ success: true, album });
  } catch (error) {
    console.error("Album creation error:", error);
    return NextResponse.json(
      { error: "Failed to create album" },
      { status: 500 }
    );
  }
}
