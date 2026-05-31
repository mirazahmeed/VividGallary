import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

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

    // Access check: User must own the album or have collaborative permissions
    const hasPermission =
      album.userId === session.userId ||
      album.permissions.some((p: any) => p.userId === session.userId) ||
      album.visibility === "PUBLIC";

    if (!hasPermission) {
      // If password protected, client must send valid access token or login
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ success: true, album });
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
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (coverMediaId !== undefined) updateData.coverMediaId = coverMediaId;

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

    if (album.userId !== session.userId) {
      return NextResponse.json({ error: "Only the owner can delete this album" }, { status: 403 });
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
