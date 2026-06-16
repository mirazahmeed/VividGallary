import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { secureMediaUrls } from "@/lib/mediaUrl";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // IMAGE or VIDEO
    const favorite = searchParams.get("favorite"); // "true"
    const archived = searchParams.get("archived"); // "true"
    const trash = searchParams.get("trash"); // "true"
    const albumId = searchParams.get("albumId");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");
    const targetUserId = searchParams.get("userId");
    let resolvedUserId = session.userId;

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
      if (user) {
        resolvedUserId = user.id;
      } else {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }

    const whereClause: any = {
      userId: resolvedUserId,
    };

    // If querying someone else's media, only show public items
    if (resolvedUserId !== session.userId) {
      whereClause.visibility = "PUBLIC";
    }

    // Filter by trash state (default: exclude trashed files)
    if (trash === "true") {
      whereClause.inTrash = true;
    } else {
      whereClause.inTrash = false;
      
      // Filter by archive state (default: exclude archived files in main gallery)
      if (archived === "true") {
        whereClause.isArchived = true;
      } else if (archived === "false") {
        whereClause.isArchived = false;
      } else {
        // If not explicitly searching archive or favorite, default hide archived from main gallery
        if (!favorite && !albumId && !tag && !search) {
          whereClause.isArchived = false;
        }
      }
    }

    // Filter by type
    if (type === "IMAGE" || type === "VIDEO") {
      whereClause.type = type;
    }

    // Filter by favorite
    if (favorite === "true") {
      whereClause.isFavorite = true;
    }

    // Filter by album ID
    if (albumId) {
      whereClause.albums = {
        some: {
          albumId: albumId,
        },
      };
    }

    // Filter by tag
    if (tag) {
      whereClause.tags = {
        some: {
          tag: {
            name: tag,
          },
        },
      };
    }

    // Filter by filename / tag search query
    if (search) {
      whereClause.OR = [
        { filename: { contains: search } },
        {
          tags: {
            some: {
              tag: {
                name: { contains: search }
              }
            }
          }
        }
      ];
    }

    const mediaItems = await prisma.media.findMany({
      where: whereClause,
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
        likes: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const securedMedia = secureMediaUrls(mediaItems, session.userId);
    return NextResponse.json({ success: true, media: securedMedia });
  } catch (error) {
    console.error("Gallery fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch gallery media" },
      { status: 500 }
    );
  }
}

// Bulk update endpoint (archive, favorite, restore, move to trash, permanent delete)
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { ids, action, albumId } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid or empty IDs list" }, { status: 400 });
    }

    // Validate media belong to the user
    const mediaCount = await prisma.media.count({
      where: {
        id: { in: ids },
        userId: session.userId,
      },
    });

    if (mediaCount !== ids.length) {
      return NextResponse.json({ error: "Unauthorized access to some files" }, { status: 403 });
    }

    let updateData: any = {};
    let details = "";

    switch (action) {
      case "FAVORITE":
        updateData = { isFavorite: true };
        details = `Favorited ${ids.length} items`;
        break;
      case "UNFAVORITE":
        updateData = { isFavorite: false };
        details = `Unfavorited ${ids.length} items`;
        break;
      case "ARCHIVE":
        updateData = { isArchived: true };
        details = `Archived ${ids.length} items`;
        break;
      case "UNARCHIVE":
        updateData = { isArchived: false };
        details = `Restored from archive ${ids.length} items`;
        break;
      case "TRASH":
        updateData = { inTrash: true };
        details = `Moved ${ids.length} items to Trash`;
        break;
      case "RESTORE":
        updateData = { inTrash: false };
        details = `Restored ${ids.length} items from Trash`;
        break;
      case "ADD_TO_ALBUM":
        if (!albumId) {
          return NextResponse.json({ error: "Album ID is required" }, { status: 400 });
        }
        // Verify album ownership
        const album = await prisma.album.findUnique({
          where: { id: albumId, userId: session.userId },
        });
        if (!album) {
          return NextResponse.json({ error: "Album not found or unauthorized" }, { status: 404 });
        }

        // Add each media item to the album and sync visibility
        const targetMediaVisibility = album.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
        await Promise.all(
          ids.map(async (mediaId) => {
            try {
              await prisma.mediaAlbum.create({
                data: { mediaId, albumId },
              });
              await prisma.media.update({
                where: { id: mediaId },
                data: { visibility: targetMediaVisibility },
              });
            } catch {
              // Ignore duplicates
            }
          })
        );
        
        details = `Added ${ids.length} items to Album "${album.name}"`;
        break;

      case "MAKE_PUBLIC":
        updateData = { visibility: "PUBLIC" };
        details = `Made ${ids.length} items public`;
        break;
      case "MAKE_PRIVATE":
        updateData = { visibility: "PRIVATE" };
        details = `Made ${ids.length} items private`;
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action !== "ADD_TO_ALBUM") {
      await prisma.media.updateMany({
        where: {
          id: { in: ids },
          userId: session.userId,
        },
        data: updateData,
      });
    }

    // Log the bulk action
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: `MEDIA_BULK_${action}`,
        details,
      },
    });

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error) {
    console.error("Bulk media update error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk operation" },
      { status: 500 }
    );
  }
}

// Bulk permanent delete endpoint
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid or empty IDs list" }, { status: 400 });
    }

    // Fetch files to delete from storage and recalculate space
    const files = await prisma.media.findMany({
      where: {
        id: { in: ids },
        userId: session.userId,
      },
    });

    if (files.length === 0) {
      return NextResponse.json({ error: "No media found to delete" }, { status: 404 });
    }

    let totalDeletedSize = 0;

    // Delete files from storage
    await Promise.all(
      files.map(async (file: any) => {
        await storage.delete(file.url);
        if (file.thumbnailUrl) {
          await storage.delete(file.thumbnailUrl);
        }
        totalDeletedSize += file.size;
      })
    );

    // Delete from DB
    await prisma.media.deleteMany({
      where: {
        id: { in: files.map((f: any) => f.id) },
      },
    });

    // Update user's storage limits
    const updatedUser = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    
    if (updatedUser) {
      const newStorageUsed = Math.max(0, updatedUser.storageUsed - totalDeletedSize);
      await prisma.user.update({
        where: { id: session.userId },
        data: { storageUsed: newStorageUsed },
      });
    }

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "MEDIA_PERMANENT_DELETE",
        details: `Permanently deleted ${files.length} items (freed ${(totalDeletedSize / 1024 / 1024).toFixed(2)} MB)`,
      },
    });

    return NextResponse.json({ success: true, deletedCount: files.length });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Failed to delete files" }, { status: 500 });
  }
}
