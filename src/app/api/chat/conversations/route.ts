import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { secureMediaItem } from "@/lib/mediaUrl";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: session.userId },
          { receiverId: session.userId },
        ],
      },
      orderBy: {
        createdAt: "desc",
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

    const conversationsMap = new Map();

    for (const msg of messages) {
      const otherUser = msg.senderId === session.userId ? msg.receiver : msg.sender;
      if (!otherUser) continue;

      if (!conversationsMap.has(otherUser.id)) {
        conversationsMap.set(otherUser.id, {
          user: otherUser,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            media: msg.media,
          },
          unreadCount: 0
        });
      }
    }

    const conversations = Array.from(conversationsMap.values());

    // Count unread messages for each conversation
    for (const convo of conversations) {
      const unread = await prisma.message.count({
        where: {
          senderId: convo.user.id,
          receiverId: session.userId,
          isRead: false
        }
      });
      convo.unreadCount = unread;

      // Secure media url if present in the last message
      if (convo.lastMessage.media) {
        convo.lastMessage.media = secureMediaItem(convo.lastMessage.media, session.userId);
      }
    }

    return new NextResponse(JSON.stringify({ success: true, conversations }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    });
  } catch (error) {
    console.error("Fetch conversations error:", error);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}
