import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureMediaItem } from "@/lib/mediaUrl";

// GET — Retrieve posts for a user
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");

    if (!userId && !search) {
      return NextResponse.json({ error: "userId or search query parameter is required" }, { status: 400 });
    }

    let resolvedUserId = userId;
    if (userId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: userId },
            { username: userId }
          ]
        },
        select: { id: true }
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      resolvedUserId = user.id;
    }

    const whereClause: any = {};
    if (resolvedUserId) {
      whereClause.userId = resolvedUserId;
    }
    if (search) {
      whereClause.content = {
        contains: search
      };
    }

    const posts = await prisma.post.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, username: true }
        },
        media: {
          select: {
            id: true,
            filename: true,
            type: true,
            url: true,
            thumbnailUrl: true,
            size: true,
            mimeType: true,
            width: true,
            height: true,
            duration: true
          }
        },
        likes: {
          select: { id: true, userId: true }
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, username: true }
            }
          }
        }
      }
    });

    // Fetch albums for the feed
    const albumsWhereClause: any = {};
    if (resolvedUserId) {
      albumsWhereClause.userId = resolvedUserId;
      if (resolvedUserId !== session.userId) {
        albumsWhereClause.visibility = "PUBLIC";
      }
    } else if (search) {
      albumsWhereClause.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ];
      albumsWhereClause.AND = [
        {
          OR: [
            { userId: session.userId },
            { visibility: "PUBLIC" }
          ]
        }
      ];
    } else {
      // General explore feed (only show public albums from others or own albums)
      albumsWhereClause.OR = [
        { userId: session.userId },
        { visibility: "PUBLIC" }
      ];
    }

    const albums = await prisma.album.findMany({
      where: {
        ...albumsWhereClause,
        media: {
          some: {} // Only show albums with items
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, username: true }
        },
        media: {
          include: {
            media: {
              select: {
                id: true,
                filename: true,
                type: true,
                url: true,
                thumbnailUrl: true,
                size: true,
                mimeType: true,
                width: true,
                height: true,
                duration: true
              }
            }
          },
          orderBy: { addedAt: "asc" }
        }
      }
    });

    // Map posts to feed format
    const postFeed = posts.map(p => ({
      ...p,
      feedType: "POST" as const,
      media: p.media ? secureMediaItem(p.media, session.userId) : null
    }));

    // Map albums to feed format
    const albumFeed = albums.map(a => ({
      id: a.id,
      feedType: "ALBUM" as const,
      content: a.description || null,
      createdAt: a.createdAt,
      userId: a.userId,
      user: a.user,
      albumDetails: {
        name: a.name,
        isDefault: a.isDefault,
        visibility: a.visibility
      },
      media: null,
      albumMedia: a.media.map(m => secureMediaItem(m.media, session.userId)),
      likes: [],
      comments: []
    }));

    // Combine and sort by createdAt desc
    const combinedFeed = [...postFeed, ...albumFeed];
    combinedFeed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, posts: combinedFeed });
  } catch (error) {
    console.error("Posts fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

// POST — Create a new post
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { content, mediaId } = await req.json();

    if (!content?.trim() && !mediaId) {
      return NextResponse.json({ error: "Post content or media attachment is required" }, { status: 400 });
    }

    // Verify media attachment if provided
    if (mediaId) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId, userId: session.userId }
      });
      if (!media) {
        return NextResponse.json({ error: "Media attachment not found in your gallery" }, { status: 404 });
      }
    }

    const post = await prisma.post.create({
      data: {
        userId: session.userId,
        content: content?.trim() || null,
        mediaId: mediaId || null
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, username: true }
        },
        media: {
          select: {
            id: true,
            filename: true,
            type: true,
            url: true,
            thumbnailUrl: true,
            size: true,
            mimeType: true,
            width: true,
            height: true,
            duration: true
          }
        },
        likes: {
          select: { id: true, userId: true }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, username: true }
            }
          }
        }
      }
    });

    // Secure media URL
    if (post.media) {
      post.media = secureMediaItem(post.media, session.userId);
    }

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "CREATE_POST",
        details: `Created a new post (media: ${mediaId ? "yes" : "no"})`
      }
    });

    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
