import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const mimeType = file.type || "image/jpeg";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed for avatars" }, { status: 400 });
    }

    // Limit avatar size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Avatar size must be less than 5MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `avatar-${session.userId}-${Date.now()}.${file.name.split(".").pop()}`;

    // Upload to active storage
    const avatarUrl = await storage.upload(buffer, filename, mimeType);

    // Get current user to see if they have an old avatar to delete from storage
    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { avatarUrl: true },
    });

    if (currentUser?.avatarUrl) {
      try {
        await storage.delete(currentUser.avatarUrl);
      } catch (e) {
        console.error("Failed to delete old avatar image from storage:", e);
      }
    }

    // Update avatarUrl in database
    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "USER_AVATAR_UPDATE",
        details: `Uploaded new profile picture avatar`,
      },
    });

    return NextResponse.json({ success: true, avatarUrl, user: updatedUser });
  } catch (error) {
    console.error("Avatar upload error:", error);
    return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
  }
}
