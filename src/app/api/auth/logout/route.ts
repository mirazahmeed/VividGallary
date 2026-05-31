import { NextResponse } from "next/server";
import { deleteSession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (session) {
      await prisma.activityLog.create({
        data: {
          userId: session.userId,
          action: "USER_LOGOUT",
          details: "User logged out",
        },
      });
    }

    await deleteSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
