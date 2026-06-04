import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureMediaUrls } from "@/lib/mediaUrl";

// GET — Fetch PUBLIC media only from users the current user follows
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    // Get IDs of users the current user follows
    const followingRecords = await prisma.follow.findMany({
      where: { followerId: session.userId },
      select: { followingId: true },
    });
    const followingIds = followingRecords.map((f) => f.followingId);

    if (followingIds.length === 0) {
      return NextResponse.json({ success: true, media: [] });
    }

    const whereConditions: any[] = [
      { inTrash: false },
      { isArchived: false },
      { userId: { in: followingIds } },
      {
        OR: [
          { visibility: "PUBLIC" },
          {
            albums: {
              some: {
                album: {
                  visibility: "PUBLIC",
                },
              },
            },
          },
        ],
      },
    ];

    if (type === "IMAGE" || type === "VIDEO") {
      whereConditions.push({ type });
    }

    if (search) {
      whereConditions.push({
        OR: [
          { filename: { contains: search } },
          {
            tags: {
              some: {
                tag: {
                  name: { contains: search },
                },
              },
            },
          },
        ],
      });
    }

    const whereClause = {
      AND: whereConditions,
    };

    const mediaItems = await prisma.media.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        tags: {
          include: { tag: true },
        },
        likes: true,
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // All users in this feed are followed by definition
    const enrichedMedia = mediaItems.map((item) => ({
      ...item,
      user: {
        ...item.user,
        isFollowing: true,
      },
    }));

    const securedMedia = secureMediaUrls(enrichedMedia, session.userId);
    return NextResponse.json({ success: true, media: securedMedia });
  } catch (error) {
    console.error("Following feed error:", error);
    return NextResponse.json({ error: "Failed to fetch following feed" }, { status: 500 });
  }
}
