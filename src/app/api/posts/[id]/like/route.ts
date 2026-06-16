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

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if like already exists
    const existingLike = await prisma.like.findFirst({
      where: {
        postId,
        userId: session.userId
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
          postId,
          userId: session.userId
        }
      });

      // Trigger notification if the liker is not the post author
      if (post.userId !== session.userId) {
        const liker = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { name: true }
        });
        await prisma.notification.create({
          data: {
            userId: post.userId,
            senderId: session.userId,
            type: "LIKE",
            content: `${liker?.name || "Someone"} liked your post.`,
            postId
          }
        });
      }

      return NextResponse.json({ success: true, liked: true });
    }
  } catch (error) {
    console.error("Post like toggle error:", error);
    return NextResponse.json({ error: "Failed to like/unlike post" }, { status: 500 });
  }
}
