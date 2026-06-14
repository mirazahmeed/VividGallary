import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Retrieve all tags
    const tags = await prisma.tag.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error("Fetch tags error:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
