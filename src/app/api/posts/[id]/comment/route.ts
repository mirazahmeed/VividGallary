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

    const { id: postId } = await params;
    const { content } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        postId,
        userId: session.userId,
        content: content.trim()
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, username: true }
        }
      }
    });

    // Trigger notification if the commenter is not the post author
    if (post.userId !== session.userId) {
      const displayContent = content.trim().length > 30 
        ? `${content.trim().substring(0, 30)}...` 
        : content.trim();
      await prisma.notification.create({
        data: {
          userId: post.userId,
          senderId: session.userId,
          type: "COMMENT",
          content: `${comment.user.name || "Someone"} commented: "${displayContent}"`,
          postId
        }
      });
    }

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error("Post comment error:", error);
    return NextResponse.json({ error: "Failed to add comment to post" }, { status: 500 });
  }
}
