import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// PATCH — Mark specific notification as read
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    if (notification.userId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return NextResponse.json({ success: true, notification: updated });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

// DELETE — Delete a specific notification
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    if (notification.userId !== session.userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    await prisma.notification.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("Delete notification error:", error);
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
