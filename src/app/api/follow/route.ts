import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET — Retrieve current user's following list and follower/following counts
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [following, followersCount, followingCount] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: session.userId },
        include: {
          following: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.follow.count({ where: { followingId: session.userId } }),
      prisma.follow.count({ where: { followerId: session.userId } }),
    ]);

    return NextResponse.json({
      success: true,
      following: following.map((f) => f.following),
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Follow GET error:", error);
    return NextResponse.json({ error: "Failed to fetch follow data" }, { status: 500 });
  }
}

// POST — Follow a user
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 });
    }

    if (targetUserId === session.userId) {
      return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: targetUserId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Already following this user" }, { status: 409 });
    }

    await prisma.follow.create({
      data: {
        followerId: session.userId,
        followingId: targetUserId,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "USER_FOLLOW",
        details: `Followed user ${targetUser.name || targetUser.email}`,
      },
    });

    return NextResponse.json({ success: true, followed: true });
  } catch (error) {
    console.error("Follow POST error:", error);
    return NextResponse.json({ error: "Failed to follow user" }, { status: 500 });
  }
}

// DELETE — Unfollow a user
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 });
    }

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: targetUserId,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "You are not following this user" }, { status: 404 });
    }

    await prisma.follow.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true, followed: false });
  } catch (error) {
    console.error("Follow DELETE error:", error);
    return NextResponse.json({ error: "Failed to unfollow user" }, { status: 500 });
  }
}
