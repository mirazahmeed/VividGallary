import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureMediaItem } from "@/lib/mediaUrl";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all"; // all, following
    const type = searchParams.get("type") || "all"; // all, posts, photos, videos, albums
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const offset = (page - 1) * limit;
    const itemsToFetch = page * limit;

    // Get following user IDs for following filter and follow indicator
    const followingRecords = await prisma.follow.findMany({
      where: { followerId: session.userId },
      select: { followingId: true }
    });
    const followingIds = followingRecords.map(f => f.followingId);
    const followingSet = new Set(followingIds);
    const feedUserIds = [session.userId, ...followingIds];

    let posts: any[] = [];
    let albums: any[] = [];
    let mediaItems: any[] = [];

    // 1. Fetch Posts
    if (type === "all" || type === "posts") {
      const postsWhere: any = {};
      if (filter === "following") {
        postsWhere.userId = { in: feedUserIds };
      }
      if (search) {
        postsWhere.content = { contains: search };
      }
      posts = await prisma.post.findMany({
        where: postsWhere,
        orderBy: { createdAt: "desc" },
        take: itemsToFetch,
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, username: true }
          },
          media: {
            select: {
              id: true, filename: true, type: true, url: true, thumbnailUrl: true,
              size: true, mimeType: true, width: true, height: true, duration: true
            }
          },
          likes: { select: { id: true, userId: true } },
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
    }

    // 2. Fetch Albums
    if (type === "all" || type === "albums") {
      const albumsWhere: any = {};
      if (filter === "following") {
        albumsWhere.OR = [
          { userId: session.userId },
          { userId: { in: followingIds }, visibility: "PUBLIC" }
        ];
      } else {
        albumsWhere.OR = [
          { userId: session.userId },
          { visibility: "PUBLIC" }
        ];
      }
      if (search) {
        albumsWhere.AND = [
          ...(albumsWhere.OR ? [{ OR: albumsWhere.OR }] : []),
          {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } }
            ]
          }
        ];
        delete albumsWhere.OR;
      }
      albums = await prisma.album.findMany({
        where: {
          ...albumsWhere,
          media: { some: {} } // Only show albums with items
        },
        orderBy: { createdAt: "desc" },
        take: itemsToFetch,
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, username: true }
          },
          media: {
            include: {
              media: {
                select: {
                  id: true, filename: true, type: true, url: true, thumbnailUrl: true,
                  size: true, mimeType: true, width: true, height: true, duration: true
                }
              }
            },
            orderBy: { addedAt: "asc" }
          }
        }
      });
    }

    // 3. Fetch Standalone Media Uploads (not attached to any post)
    if (type === "all" || type === "photos" || type === "videos") {
      const mediaWhere: any = {
        inTrash: false,
        isArchived: false,
        posts: { none: {} } // Only standalone media uploads
      };

      if (type === "photos") {
        mediaWhere.type = "IMAGE";
      } else if (type === "videos") {
        mediaWhere.type = "VIDEO";
      }

      if (filter === "following") {
        mediaWhere.OR = [
          { userId: session.userId },
          { userId: { in: followingIds }, visibility: "PUBLIC" }
        ];
      } else {
        mediaWhere.OR = [
          { userId: session.userId },
          { visibility: "PUBLIC" }
        ];
      }

      if (search) {
        mediaWhere.AND = [
          ...(mediaWhere.OR ? [{ OR: mediaWhere.OR }] : []),
          { filename: { contains: search } }
        ];
        delete mediaWhere.OR;
      }

      mediaItems = await prisma.media.findMany({
        where: mediaWhere,
        orderBy: { createdAt: "desc" },
        take: itemsToFetch,
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, username: true }
          },
          likes: { select: { id: true, userId: true } },
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
    }

    // Map all types to unified feed format
    const postFeed = posts.map(p => ({
      id: p.id,
      feedType: "POST" as const,
      content: p.content,
      createdAt: p.createdAt,
      userId: p.userId,
      user: {
        ...p.user,
        isFollowing: followingSet.has(p.user.id)
      },
      media: p.media ? secureMediaItem(p.media, session.userId) : null,
      likes: p.likes,
      comments: p.comments
    }));

    const albumFeed = albums.map(a => ({
      id: a.id,
      feedType: "ALBUM" as const,
      content: a.description || null,
      createdAt: a.createdAt,
      userId: a.userId,
      user: {
        ...a.user,
        isFollowing: followingSet.has(a.user.id)
      },
      albumDetails: {
        name: a.name,
        isDefault: a.isDefault,
        visibility: a.visibility
      },
      media: null,
      albumMedia: a.media.map((m: any) => secureMediaItem(m.media, session.userId)),
      likes: [],
      comments: []
    }));

    const mediaFeed = mediaItems.map(m => ({
      id: m.id,
      feedType: "MEDIA" as const,
      content: null,
      createdAt: m.createdAt,
      userId: m.userId,
      user: {
        ...m.user,
        isFollowing: followingSet.has(m.user.id)
      },
      media: secureMediaItem(m, session.userId),
      likes: m.likes,
      comments: m.comments
    }));

    // Combine and sort by createdAt desc
    const combinedFeed = [...postFeed, ...albumFeed, ...mediaFeed];
    combinedFeed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Slice for current page/limit pagination
    const paginatedFeed = combinedFeed.slice(offset, offset + limit);
    const hasMore = combinedFeed.length > offset + limit;

    return NextResponse.json({ success: true, posts: paginatedFeed, hasMore });
  } catch (error) {
    console.error("Timeline feed API error:", error);
    return NextResponse.json({ error: "Failed to fetch timeline feed" }, { status: 500 });
  }
}
