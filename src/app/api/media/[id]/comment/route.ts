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
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    // Verify media exists and is not in trash
    const media = await prisma.media.findFirst({
      where: { id, inTrash: false }
    });
    if (!media) {
      return NextResponse.json({ error: "Media item not found" }, { status: 404 });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        mediaId: id,
        userId: session.userId,
        content: content.trim()
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, username: true }
        }
      }
    });

    // Trigger notification if the commenter is not the author
    if (media.userId !== session.userId) {
      const displayContent = content.trim().length > 30 
        ? `${content.trim().substring(0, 30)}...` 
        : content.trim();
      await prisma.notification.create({
        data: {
          userId: media.userId,
          senderId: session.userId,
          type: "COMMENT",
          content: `${comment.user.name || "Someone"} commented on your upload: "${displayContent}"`,
          mediaId: id
        }
      });
    }

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("Media comment creation error:", error);
    return NextResponse.json({ error: "Failed to add comment to media item" }, { status: 500 });
  }
}
