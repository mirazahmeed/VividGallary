import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: id },
          { username: id }
        ]
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
        bio: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const resolvedUserId = user.id;

    // Fetch stats
    const postsCount = await prisma.post.count({ where: { userId: resolvedUserId } });
    const albumsCount = await prisma.album.count({ where: { userId: resolvedUserId } });
    const friendshipsCount = await prisma.friendship.count({
      where: {
        status: "ACCEPTED",
        OR: [
          { senderId: resolvedUserId },
          { receiverId: resolvedUserId }
        ]
      }
    });

    const stats = {
      postsCount,
      albumsCount,
      friendshipsCount
    };

    // Check if the current user is following this profile user
    const isFollowing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: resolvedUserId
        }
      }
    }) !== null;

    // Check friendship status
    let friendshipStatus = "NONE";
    if (session.userId !== resolvedUserId) {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: session.userId, receiverId: resolvedUserId },
            { senderId: resolvedUserId, receiverId: session.userId }
          ]
        }
      });
      if (friendship) {
        if (friendship.status === "ACCEPTED") {
          friendshipStatus = "ACCEPTED";
        } else if (friendship.senderId === session.userId) {
          friendshipStatus = "PENDING_SENT";
        } else {
          friendshipStatus = "PENDING_RECEIVED";
        }
      }
    }

    return NextResponse.json({ success: true, user, stats, isFollowing, friendshipStatus });
  } catch (error) {
    console.error("User profile fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}
