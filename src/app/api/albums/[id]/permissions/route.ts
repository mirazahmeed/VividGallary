import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST: Add collaborator (create or update permission)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: albumId } = await params;
    const { email, role } = await req.json();

    if (!email || !role || !["VIEWER", "CONTRIBUTOR", "EDITOR"].includes(role)) {
      return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });
    }

    // Verify album exists and user is the owner
    const album = await prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (album.userId !== session.userId) {
      return NextResponse.json({ error: "Only the album owner can manage collaborators" }, { status: 403 });
    }

    // Find the user to invite
    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User with this email not found" }, { status: 404 });
    }

    // Check if the user is the owner
    if (targetUser.id === album.userId) {
      return NextResponse.json({ error: "The album owner already has full access" }, { status: 400 });
    }

    // Create or update permission
    const permission = await prisma.permission.upsert({
      where: {
        albumId_userId: {
          albumId,
          userId: targetUser.id,
        },
      },
      update: { role },
      create: {
        albumId,
        userId: targetUser.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_COLLABORATOR_ADD",
        details: `Added/updated collaborator ${email} as ${role} for album "${album.name}"`,
      },
    });

    return NextResponse.json({ success: true, permission });
  } catch (error) {
    console.error("Collaborator add error:", error);
    return NextResponse.json({ error: "Failed to add collaborator" }, { status: 500 });
  }
}

// PUT: Update collaborator's role
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: albumId } = await params;
    const { userId, role } = await req.json();

    if (!userId || !role || !["VIEWER", "CONTRIBUTOR", "EDITOR"].includes(role)) {
      return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });
    }

    // Verify album exists and user is owner
    const album = await prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (album.userId !== session.userId) {
      return NextResponse.json({ error: "Only the album owner can manage collaborators" }, { status: 403 });
    }

    const permission = await prisma.permission.update({
      where: {
        albumId_userId: {
          albumId,
          userId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_COLLABORATOR_UPDATE",
        details: `Updated collaborator role to ${role} for album "${album.name}"`,
      },
    });

    return NextResponse.json({ success: true, permission });
  } catch (error) {
    console.error("Collaborator update error:", error);
    return NextResponse.json({ error: "Failed to update collaborator" }, { status: 500 });
  }
}

// DELETE: Remove collaborator
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: albumId } = await params;
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Verify album exists and user is owner
    const album = await prisma.album.findUnique({
      where: { id: albumId },
    });

    if (!album) {
      return NextResponse.json({ error: "Album not found" }, { status: 404 });
    }

    if (album.userId !== session.userId) {
      return NextResponse.json({ error: "Only the album owner can manage collaborators" }, { status: 403 });
    }

    await prisma.permission.delete({
      where: {
        albumId_userId: {
          albumId,
          userId,
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "ALBUM_COLLABORATOR_REMOVE",
        details: `Removed collaborator from album "${album.name}"`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Collaborator remove error:", error);
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 });
  }
}
