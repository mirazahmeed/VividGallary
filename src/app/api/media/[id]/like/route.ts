import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Verify media exists and is not in trash
    const media = await prisma.media.findFirst({
      where: { id, inTrash: false }
    });
    if (!media) {
      return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    }

    // Check if like already exists
    const existingLike = await prisma.like.findUnique({
      where: {
        mediaId_userId: {
          mediaId: id,
          userId: session.userId
        }
      }
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({
        where: { id: existingLike.id }
      });
      return NextResponse.json({ success: true, liked: false });
    } else {
      // Like
      await prisma.like.create({
        data: {
          mediaId: id,
          userId: session.userId
        }
      });

      // Trigger notification if the liker is not the author
      if (media.userId !== session.userId) {
        const liker = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { name: true }
        });
        await prisma.notification.create({
          data: {
            userId: media.userId,
            senderId: session.userId,
            type: "LIKE",
            content: `${liker?.name || "Someone"} liked your upload: "${media.filename}".`,
            mediaId: id
          }
        });
      }

      return NextResponse.json({ success: true, liked: true });
    }
  } catch (error) {
    console.error("Media like toggle error:", error);
    return NextResponse.json({ error: "Failed to like/unlike media item" }, { status: 500 });
  }
}
