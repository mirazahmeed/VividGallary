import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureMediaUrls } from "@/lib/mediaUrl";

// GET — Fetch all PUBLIC media from all users (excluding the current user)
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // IMAGE or VIDEO
    const search = searchParams.get("search");

    const whereConditions: any[] = [
      { inTrash: false },
      { isArchived: false },
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

    // Get IDs the current user follows for the isFollowing flag
    const followingIds = await prisma.follow.findMany({
      where: { followerId: session.userId },
      select: { followingId: true },
    });
    const followingSet = new Set(followingIds.map((f) => f.followingId));

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

    // Attach isFollowing flag to each item's user
    const enrichedMedia = mediaItems.map((item) => ({
      ...item,
      user: {
        ...item.user,
        isFollowing: followingSet.has(item.user.id),
      },
    }));

    const securedMedia = secureMediaUrls(enrichedMedia, session.userId);
    return NextResponse.json({ success: true, media: securedMedia });
  } catch (error) {
    console.error("Explore feed error:", error);
    return NextResponse.json({ error: "Failed to fetch explore feed" }, { status: 500 });
  }
}
