import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET — Retrieve current user profile details
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatarUrl: true,
        bio: true,
        storageLimit: true,
        storageUsed: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Failed to fetch profile settings" }, { status: 500 });
  }
}

// PUT — Update current user profile details
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { name, bio, avatarUrl, username } = await req.json();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

    if (username !== undefined) {
      const sanitizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
      if (sanitizedUsername.length < 3) {
        return NextResponse.json({ error: "Username must be at least 3 characters and only contain alphanumeric characters, dots, or underscores" }, { status: 400 });
      }

      // Check if username is already taken by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          username: sanitizedUsername,
          NOT: { id: session.userId }
        }
      });
      if (existingUser) {
        return NextResponse.json({ error: "Username is already taken by another creator" }, { status: 400 });
      }
      updateData.username = sanitizedUsername;
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        avatarUrl: true,
        bio: true,
        storageLimit: true,
        storageUsed: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "USER_PROFILE_UPDATE",
        details: `Updated profile details (name: ${name || "none"})`,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json({ error: "Failed to update profile settings" }, { status: 500 });
  }
}
