import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { secureMediaItem } from "@/lib/mediaUrl";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Share token is required" }, { status: 400 });
    }

    const share = await prisma.share.findUnique({
      where: { token },
      include: {
        media: true,
        album: {
          include: {
            coverMedia: true,
            media: {
              include: {
                media: true,
              },
            },
          },
        },
        playlist: {
          include: {
            items: {
              include: {
                media: true,
              },
              orderBy: {
                order: "asc",
              },
            },
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json({ error: "Share link not found or invalid" }, { status: 404 });
    }

    // Expiry check
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    // Password verification check
    if (share.passwordHash) {
      if (!password) {
        // Return signal to frontend to prompt for password input
        return NextResponse.json({ passwordRequired: true }, { status: 401 });
      }

      const isValid = verifyPassword(password, share.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid password" }, { status: 403 });
      }
    }

    // Audit logs for public link access
    await prisma.activityLog.create({
      data: {
        action: "SHARE_LINK_ACCESS",
        details: `Accessed ${share.type.toLowerCase()} link (token: ${token.substring(0, 8)}...)`,
      },
    });

    // Strip password credentials before sending payload
    const sanitizedShare = {
      ...share,
      passwordHash: undefined,
    };

    // Secure all media URLs with signed stream tokens
    const securedShare = secureMediaItem(sanitizedShare, "share-guest");

    return NextResponse.json({ success: true, share: securedShare });
  } catch (error) {
    console.error("Share access error:", error);
    return NextResponse.json({ error: "Access check failed" }, { status: 500 });
  }
}
