import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    const users = await prisma.user.findMany({
      where: {
        id: { not: session.userId },
        OR: [
          { name: { contains: query } },
          { email: { contains: query } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        avatarUrl: true,
        bio: true,
      },
      take: 20,
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Search users error:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
