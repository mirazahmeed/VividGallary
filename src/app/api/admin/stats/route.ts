import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    // Role-based auth guard
    await requireAdmin(req as any);

    const totalUsers = await prisma.user.count();
    
    // Aggregate storage consumption in bytes
    const storageAggregation = await prisma.user.aggregate({
      _sum: {
        storageUsed: true,
      },
    });
    const totalStorageUsed = storageAggregation._sum.storageUsed || 0;

    // Aggregate files and categories
    const totalMedia = await prisma.media.count();
    const photosCount = await prisma.media.count({ where: { type: "IMAGE" } });
    const videosCount = await prisma.media.count({ where: { type: "VIDEO" } });
    
    const totalAlbums = await prisma.album.count();
    const totalPlaylists = await prisma.playlist.count();
    const totalShares = await prisma.share.count();

    // Fetch storage metrics per user for ranking
    const topUsers = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storageUsed: true,
        storageLimit: true,
      },
      orderBy: {
        storageUsed: "desc",
      },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalStorageUsed,
        totalMedia,
        photosCount,
        videosCount,
        totalAlbums,
        totalPlaylists,
        totalShares,
        topUsers,
      },
    });
  } catch (error: any) {
    console.error("Admin stats fetch error:", error);
    return NextResponse.json(
      { error: error.message === "Forbidden" ? "Forbidden access" : "Unauthorized" },
      { status: error.message === "Forbidden" ? 403 : 401 }
    );
  }
}
