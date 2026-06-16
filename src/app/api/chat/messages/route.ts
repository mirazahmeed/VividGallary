import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureMediaItem } from "@/lib/mediaUrl";

// GET — Retrieve conversation messages history with a specific user
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const otherUserId = searchParams.get("userId");

    if (!otherUserId) {
      return NextResponse.json({ error: "userId parameter is required" }, { status: 400 });
    }

    // Mark unread messages from other user as read
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: session.userId,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: session.userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: session.userId },
        ],
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        receiver: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        media: {
          select: {
            id: true,
            filename: true,
            type: true,
            url: true,
            thumbnailUrl: true,
            size: true,
            mimeType: true,
            width: true,
            height: true,
            duration: true
          }
        }
      }
    });

    const securedMessages = messages.map((msg) => {
      if (msg.media) {
        msg.media = secureMediaItem(msg.media, session.userId);
      }
      return msg;
    });

    return NextResponse.json({ success: true, messages: securedMessages });
  } catch (error) {
    console.error("Fetch messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

// POST — Create and send a new message (text and/or media attachment)
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { receiverId, content, mediaId } = await req.json();

    if (!receiverId) {
      return NextResponse.json({ error: "receiverId is required" }, { status: 400 });
    }

    if (!content && !mediaId) {
      return NextResponse.json({ error: "Message content or mediaId is required" }, { status: 400 });
    }

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });
    if (!receiver) {
      return NextResponse.json({ error: "Receiver user not found" }, { status: 404 });
    }

    // Verify media attachment if provided
    if (mediaId) {
      const media = await prisma.media.findUnique({
        where: { id: mediaId }
      });
      if (!media) {
        return NextResponse.json({ error: "Shared media item not found" }, { status: 404 });
      }
    }

    const message = await prisma.message.create({
      data: {
        senderId: session.userId,
        receiverId,
        content: content || null,
        mediaId: mediaId || null,
        isRead: false
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        receiver: {
          select: { id: true, name: true, email: true, avatarUrl: true }
        },
        media: {
          select: {
            id: true,
            filename: true,
            type: true,
            url: true,
            thumbnailUrl: true,
            size: true,
            mimeType: true,
            width: true,
            height: true,
            duration: true
          }
        }
      }
    });

    if (message.media) {
      message.media = secureMediaItem(message.media, session.userId);
    }

    // Trigger notification if it's a media share
    if (mediaId) {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          senderId: session.userId,
          type: "SHARE",
          content: `${message.sender.name || "Someone"} shared a media item with you in chat.`,
          mediaId
        }
      });
    }

    // Create an activity log entry
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "SEND_MESSAGE",
        details: `Sent message to user ${receiverId} (media: ${mediaId ? "yes" : "no"})`,
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
