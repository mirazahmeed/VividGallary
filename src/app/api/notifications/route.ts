import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — Retrieve user's notifications
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: session.userId },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatarUrl: true, username: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return new NextResponse(JSON.stringify({ success: true, notifications }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// DELETE — Clear/Delete all notifications for the user
export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await prisma.notification.deleteMany({
      where: { userId: session.userId }
    });

    return NextResponse.json({ success: true, message: "All notifications cleared" });
  } catch (error) {
    console.error("Clear notifications error:", error);
    return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 });
  }
}

// PUT — Mark all notifications as read
export async function PUT() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: { userId: session.userId, isRead: false },
      data: { isRead: true }
    });

    return NextResponse.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark notifications as read error:", error);
    return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 });
  }
}
