import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { secureMediaItem } from "@/lib/mediaUrl";

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

    // Retrieve album with full relational depth
    const album = await prisma.album.findUnique({
      where: { id },
      include: {
        coverMedia: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        // Fetch direct child sub-albums
        children: {
          include: {
            coverMedia: true,
            _count: {
              select: {
                media: true,
              },
            },
          },
        },
        permissions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        media: {
          where: {
            media: {
              inTrash: false,
            },
          },
          include: {
            media: {
              include: {
                tags: {
                  include: {
                    tag: true,
                  },
                },
              },
            },
          },
          orderBy: {
            addedAt: "desc",
          },
        },
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    // Access check: User must own the album, have collaborative permissions, or it's public/password protected
    const isOwner = album.userId === session.userId;
    const isCollaborator = album.permissions.some((p: any) => p.userId === session.userId);
    
    let hasAccess = isOwner || isCollaborator || album.visibility === "PUBLIC";

    if (!hasAccess && album.visibility === "PASSWORD_PROTECTED") {
      const url = new URL(req.url);
      const password = url.searchParams.get("password") || req.headers.get("x-album-password");

      if (album.passwordHash) {
        if (!password) {
          return NextResponse.json({ passwordRequired: true }, { status: 401 });
        }
        if (verifyPassword(password, album.passwordHash)) {
          hasAccess = true;
        } else {
          return NextResponse.json({ error: "Invalid password" }, { status: 403 });
        }
      } else {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let resolvedCoverMedia = album.coverMedia;
    if (!resolvedCoverMedia && album.media.length > 0) {
      const firstMediaRelation = album.media[album.media.length - 1];
      if (firstMediaRelation) {
        resolvedCoverMedia = firstMediaRelation.media;
      }
    }

    const resolvedAlbum = {
      ...album,
      coverMedia: resolvedCoverMedia,
    };

    const securedAlbum = secureMediaItem(resolvedAlbum, session.userId);
    return NextResponse.json({ success: true, album: securedAlbum });
  } catch (error) {
    console.error("Album detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch album details" },
      { status: 500 }
    );
  }
}

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
    const { name, description, visibility, password, coverMediaId } = await req.json();

    const album = await prisma.album.findUnique({
      where: { id },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    // Owner and Editor verification
    const isOwner = album.userId === session.userId;
    const collaborator = await prisma.permission.findFirst({
      where: { albumId: id, userId: session.userId, role: { in: ["EDITOR", "CONTRIBUTOR"] } },
    });

    if (!isOwner && !collaborator) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const updateData: any = {};
    if (name) {
      // Block renaming the default album
      if (album.isDefault) {
        return NextResponse.json({ error: "Cannot rename the default Random Media album" }, { status: 403 });
      }
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (coverMediaId !== undefined) {
      updateData.coverMediaId = coverMediaId;
    }

    if (visibility) {
      // Only owner can change visibility settings
      if (!isOwner) {
        return NextResponse.json({ error: "Only the album owner can edit visibility rules" }, { status: 403 });
      }
      updateData.visibility = visibility;
      
      if (visibility === "PASSWORD_PROTECTED" && password) {
        updateData.passwordHash = hashPassword(password);
      } else if (visibility !== "PASSWORD_PROTECTED") {
        updateData.passwordHash = null;
      }

      // Sync all media visibility inside this album
      const targetMediaVisibility = visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE";
      const mediaRelations = await prisma.mediaAlbum.findMany({
        where: { albumId: id },
        select: { mediaId: true },
      });
      const mediaIds = mediaRelations.map((r: any) => r.mediaId);

      if (mediaIds.length > 0) {
        await prisma.media.updateMany({
          where: { id: { in: mediaIds } },
          data: { visibility: targetMediaVisibility },
        });
      }
    }

    const updatedAlbum = await prisma.album.update({
      where: { id },
      data: updateData,
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_UPDATE",
        details: `Updated album settings for "${updatedAlbum.name}"`,
      },
    });

    return NextResponse.json({ success: true, album: updatedAlbum });
  } catch (error) {
    console.error("Album edit error:", error);
    return NextResponse.json(
      { error: "Failed to update album" },
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

    const album = await prisma.album.findUnique({
      where: { id },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (album.isDefault) {
      return NextResponse.json({ error: "Cannot delete the default Random Media album" }, { status: 403 });
    }

    await prisma.album.delete({
      where: { id },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_DELETE",
        details: `Deleted album "${album.name}"`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Album delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete album" },
      { status: 500 }
    );
  }
}
