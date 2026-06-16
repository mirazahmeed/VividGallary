import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { secureMediaUrls } from "@/lib/mediaUrl";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    let resolvedUserId = targetUserId;
    if (targetUserId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: targetUserId },
            { username: targetUserId }
          ]
        },
        select: { id: true }
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      resolvedUserId = user.id;
    }

    let whereClause: any = {
      OR: [
        { userId: resolvedUserId || session.userId },
        {
          permissions: {
            some: {
              userId: session.userId,
            },
          },
        },
      ],
    };

    if (resolvedUserId && resolvedUserId !== session.userId) {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: session.userId, receiverId: resolvedUserId },
            { senderId: resolvedUserId, receiverId: session.userId }
          ],
          status: "ACCEPTED"
        }
      });

      if (!friendship) {
        whereClause = {
          userId: resolvedUserId,
          visibility: "PUBLIC"
        };
      } else {
        whereClause = {
          userId: resolvedUserId
        };
      }
    }

    // Get user's own albums AND collaborative albums they are a member of
    const ownedAlbums = await prisma.album.findMany({
      where: whereClause,
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
                type: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
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
          type: album.media[0].media.type,
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

    const securedAlbums = secureMediaUrls(albumsWithCovers, session.userId);
    return NextResponse.json({ success: true, albums: securedAlbums });
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
