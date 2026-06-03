import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    await requireAdmin(req as any);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        storageLimit: true,
        storageUsed: true,
        createdAt: true,
        _count: {
          select: {
            media: true,
            albums: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error.message === "Forbidden" ? 403 : 401 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const adminSession = await requireAdmin(req as any);
    const { userId, role, storageLimit } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Prevent admins from demoting themselves to avoid system lockout!
    if (userId === adminSession.userId && role && role !== "ADMIN") {
      return NextResponse.json({ error: "Admins cannot demote their own account" }, { status: 400 });
    }

    const updateData: any = {};
    if (role && ["ADMIN", "USER"].includes(role)) {
      updateData.role = role;
    }
    if (storageLimit !== undefined && typeof storageLimit === "number") {
      updateData.storageLimit = storageLimit;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        storageLimit: true,
        storageUsed: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: adminSession.userId,
        action: "ADMIN_USER_UPDATE",
        details: `Updated User email: ${updatedUser.email} (new role: ${updatedUser.role}, limit: ${(updatedUser.storageLimit / 1024 / 1024).toFixed(2)} MB)`,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error("Admin user update error:", error);
    return NextResponse.json(
      { error: error.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error.message === "Forbidden" ? 403 : 401 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const adminSession = await requireAdmin(req as any);
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (userId === adminSession.userId) {
      return NextResponse.json({ error: "Admins cannot delete their own account" }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete the user from SQLite (cascades to all Media, Albums, Playlists)
    await prisma.user.delete({
      where: { id: userId },
    });

    await prisma.activityLog.create({
      data: {
        userId: adminSession.userId,
        action: "ADMIN_USER_DELETE",
        details: `Permanently deleted user account: ${targetUser.email} (${targetUser.name || "No Name"})`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin user delete error:", error);
    return NextResponse.json(
      { error: error.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error.message === "Forbidden" ? 403 : 401 }
    );
  }
}
