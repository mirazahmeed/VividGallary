import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import crypto from "crypto";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const shares = await prisma.share.findMany({
      where: { userId: session.userId },
      include: {
        media: {
          select: { filename: true, url: true },
        },
        album: {
          select: { name: true },
        },
        playlist: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ success: true, shares });
  } catch (error) {
    console.error("Shares fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch share links" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const {
      type, // MEDIA, ALBUM, PLAYLIST
      mediaId,
      albumId,
      playlistId,
      password,
      durationDays, // number of days, e.g., 1, 7, 30, null for infinite
      downloadPermission,
      viewOnly,
    } = await req.json();

    if (!type || !["MEDIA", "ALBUM", "PLAYLIST"].includes(type)) {
      return NextResponse.json({ error: "Invalid share type" }, { status: 400 });
    }

    // Verify entity ownership
    if (type === "MEDIA" && mediaId) {
      const media = await prisma.media.findUnique({ where: { id: mediaId, userId: session.userId } });
      if (!media) return NextResponse.json({ error: "Media not found or unauthorized" }, { status: 404 });
    } else if (type === "ALBUM" && albumId) {
      const album = await prisma.album.findUnique({ where: { id: albumId, userId: session.userId } });
      if (!album) return NextResponse.json({ error: "Album not found or unauthorized" }, { status: 404 });
    } else if (type === "PLAYLIST" && playlistId) {
      const playlist = await prisma.playlist.findUnique({ where: { id: playlistId, userId: session.userId } });
      if (!playlist) return NextResponse.json({ error: "Playlist not found or unauthorized" }, { status: 404 });
    } else {
      return NextResponse.json({ error: "Missing corresponding entity ID" }, { status: 400 });
    }

    // Generate unique token
    const token = crypto.randomBytes(24).toString("hex");

    // Calculate expiry date
    let expiresAt: Date | null = null;
    if (durationDays && typeof durationDays === "number") {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
    }

    let passwordHash: string | null = null;
    if (password) {
      passwordHash = hashPassword(password);
    }

    const share = await prisma.share.create({
      data: {
        token,
        type,
        mediaId: type === "MEDIA" ? mediaId : null,
        albumId: type === "ALBUM" ? albumId : null,
        playlistId: type === "PLAYLIST" ? playlistId : null,
        userId: session.userId,
        passwordHash,
        expiresAt,
        downloadPermission: downloadPermission !== undefined ? downloadPermission : true,
        viewOnly: viewOnly !== undefined ? viewOnly : false,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: `SHARE_GENERATE_${type}`,
        details: `Generated share token for ${type.toLowerCase()} (expires in ${durationDays || "never"})`,
      },
    });

    return NextResponse.json({ success: true, share });
  } catch (error) {
    console.error("Share creation error:", error);
    return NextResponse.json({ error: "Failed to generate share link" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { shareId } = await req.json();

    if (!shareId) {
      return NextResponse.json({ error: "Share ID is required" }, { status: 400 });
    }

    const share = await prisma.share.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    if (share.userId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    await prisma.share.delete({
      where: { id: shareId },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: `SHARE_REVOKE_${share.type}`,
        details: `Revoked share token for ${share.type.toLowerCase()} (token: ${share.token.substring(0, 8)}...)`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Share delete error:", error);
    return NextResponse.json({ error: "Failed to delete share link" }, { status: 500 });
  }
}
