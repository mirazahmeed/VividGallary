import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — Retrieve friends or requests lists
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserIdParam = searchParams.get("userId");

    let targetUserId = targetUserIdParam;
    if (targetUserIdParam && targetUserIdParam !== session.userId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: targetUserIdParam },
            { username: targetUserIdParam }
          ]
        },
        select: { id: true }
      });
      if (user) {
        targetUserId = user.id;
      }
    }

    // 1. If checking another user's profile
    if (targetUserId && targetUserId !== session.userId) {
      // Find accepted friendships for that user
      const friendships = await prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [
            { senderId: targetUserId },
            { receiverId: targetUserId }
          ]
        },
        include: {
          sender: { select: { id: true, name: true, email: true, avatarUrl: true, username: true } },
          receiver: { select: { id: true, name: true, email: true, avatarUrl: true, username: true } }
        }
      });

      const friends = friendships.map(f => f.senderId === targetUserId ? f.receiver : f.sender);

      // Find current user's friendship status with this target user
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: session.userId, receiverId: targetUserId },
            { senderId: targetUserId, receiverId: session.userId }
          ]
        }
      });

      let status = "NONE";
      if (friendship) {
        if (friendship.status === "ACCEPTED") {
          status = "ACCEPTED";
        } else if (friendship.senderId === session.userId) {
          status = "PENDING_SENT";
        } else {
          status = "PENDING_RECEIVED";
        }
      }

      return new NextResponse(JSON.stringify({ success: true, friends, friendshipStatus: status }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        },
      });
    }

    // 2. Checking current user's friends details
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: session.userId },
          { receiverId: session.userId }
        ]
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true, username: true } },
        receiver: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true, username: true } }
      }
    });

    const friends = friendships
      .filter(f => f.status === "ACCEPTED")
      .map(f => f.senderId === session.userId ? f.receiver : f.sender);

    const incomingRequests = friendships
      .filter(f => f.status === "PENDING" && f.receiverId === session.userId)
      .map(f => f.sender);

    const outgoingRequests = friendships
      .filter(f => f.status === "PENDING" && f.senderId === session.userId)
      .map(f => f.receiver);

    return new NextResponse(JSON.stringify({
      success: true,
      friends,
      incomingRequests,
      outgoingRequests
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    });
  } catch (error) {
    console.error("Friends fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch friends details" }, { status: 500 });
  }
}

// POST — Send or Accept friend request
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { targetUserId: targetUserIdParam } = await req.json();
    if (!targetUserIdParam) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    let targetUserId = targetUserIdParam;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetUserIdParam },
          { username: targetUserIdParam }
        ]
      },
      select: { id: true }
    });
    if (user) {
      targetUserId = user.id;
    }

    if (targetUserId === session.userId) {
      return NextResponse.json({ error: "Invalid targetUserId" }, { status: 400 });
    }

    // Check if a friendship record already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: session.userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: session.userId }
        ]
      }
    });

    if (existing) {
      // If there is an incoming request from the target user, we ACCEPT it
      if (existing.status === "PENDING" && existing.receiverId === session.userId) {
        const updated = await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: "ACCEPTED" }
        });

        await prisma.activityLog.create({
          data: {
            userId: session.userId,
            action: "ACCEPT_FRIEND",
            details: `Accepted friend request from user ${targetUserId}`
          }
        });

        const accepter = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { name: true }
        });
        await prisma.notification.create({
          data: {
            userId: existing.senderId,
            senderId: session.userId,
            type: "FRIEND_REQUEST",
            content: `${accepter?.name || "Someone"} accepted your friend request.`
          }
        });

        return NextResponse.json({ success: true, status: "ACCEPTED", friendship: updated });
      }

      // If it already exists, do nothing
      return NextResponse.json({ success: true, status: existing.status, friendship: existing });
    }

    // Send a new friend request
    const newFriendship = await prisma.friendship.create({
      data: {
        senderId: session.userId,
        receiverId: targetUserId,
        status: "PENDING"
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "REQUEST_FRIEND",
        details: `Sent friend request to user ${targetUserId}`
      }
    });

    const requester = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true }
    });
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        senderId: session.userId,
        type: "FRIEND_REQUEST",
        content: `${requester?.name || "Someone"} sent you a friend request.`
      }
    });

    return NextResponse.json({ success: true, status: "PENDING_SENT", friendship: newFriendship });
  } catch (error) {
    console.error("Friend action error:", error);
    return NextResponse.json({ error: "Failed to process friend action" }, { status: 500 });
  }
}

// DELETE — Unfriend or Cancel/Reject request
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let targetUserIdParam = searchParams.get("userId");

    if (!targetUserIdParam) {
      const body = await req.json().catch(() => ({}));
      targetUserIdParam = body.targetUserId;
    }

    if (!targetUserIdParam) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    let targetUserId = targetUserIdParam;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: targetUserIdParam },
          { username: targetUserIdParam }
        ]
      },
      select: { id: true }
    });
    if (user) {
      targetUserId = user.id;
    }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: session.userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: session.userId }
        ]
      }
    });

    if (!existing) {
      return NextResponse.json({ error: "Friendship record not found" }, { status: 404 });
    }

    await prisma.friendship.delete({
      where: { id: existing.id }
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "REMOVE_FRIEND",
        details: `Removed friendship or request with user ${targetUserId}`
      }
    });

    return NextResponse.json({ success: true, message: "Friendship/request removed successfully" });
  } catch (error) {
    console.error("Friendship delete error:", error);
    return NextResponse.json({ error: "Failed to remove friendship/request" }, { status: 500 });
  }
}
