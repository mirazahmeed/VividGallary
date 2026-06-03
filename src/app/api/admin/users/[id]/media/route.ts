import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

// GET — Retrieve all media files belonging to the target user (for admin use)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req as any);
    const { id: userId } = await params;

    const media = await prisma.media.findMany({
      where: {
        userId,
        inTrash: false,
      },
      include: {
        tags: {
          include: { tag: true },
        },
        likes: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, media });
  } catch (error: any) {
    console.error("Admin GET user media error:", error);
    return NextResponse.json(
      { error: error.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error.message === "Forbidden" ? 403 : 401 }
    );
  }
}

// DELETE — Bulk delete specific media items belonging to the target user (for admin use)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await requireAdmin(req as any);
    const { id: userId } = await params;
    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid or empty IDs list" }, { status: 400 });
    }

    // Verify all specified media belong to the target user
    const files = await prisma.media.findMany({
      where: {
        id: { in: ids },
        userId: userId,
      },
    });

    if (files.length === 0) {
      return NextResponse.json({ error: "No matching media found to delete" }, { status: 404 });
    }

    let totalDeletedSize = 0;

    // Delete files from storage
    await Promise.all(
      files.map(async (file: any) => {
        try {
          await storage.delete(file.url);
          if (file.thumbnailUrl) {
            await storage.delete(file.thumbnailUrl);
          }
        } catch (e) {
          console.error(`Failed to delete storage file for ${file.filename}:`, e);
        }
        totalDeletedSize += file.size;
      })
    );

    // Delete records from database
    await prisma.media.deleteMany({
      where: {
        id: { in: files.map((f: any) => f.id) },
      },
    });

    // Deduct deleted size from user's storageUsed
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (targetUser) {
      const newStorageUsed = Math.max(0, targetUser.storageUsed - totalDeletedSize);
      await prisma.user.update({
        where: { id: userId },
        data: { storageUsed: newStorageUsed },
      });
    }

    // Log the admin's action
    await prisma.activityLog.create({
      data: {
        userId: adminSession.userId,
        action: "ADMIN_MEDIA_DELETE",
        details: `Admin deleted ${files.length} items from user ID ${userId} (freed ${(totalDeletedSize / 1024 / 1024).toFixed(2)} MB)`,
      },
    });

    return NextResponse.json({ success: true, count: files.length });
  } catch (error: any) {
    console.error("Admin DELETE user media error:", error);
    return NextResponse.json(
      { error: error.message === "Forbidden" ? "Forbidden" : "Unauthorized" },
      { status: error.message === "Forbidden" ? 403 : 401 }
    );
  }
}
