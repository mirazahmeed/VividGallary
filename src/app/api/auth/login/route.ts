import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyFirebaseToken } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Firebase ID token is required" },
        { status: 400 }
      );
    }

    // 1. Verify the client-side Firebase ID Token on server-side
    const firebaseUser = await verifyFirebaseToken(idToken);
    const { uid, email, name } = firebaseUser;

    // 2. Fetch or dynamically sync the authenticated user record in SQLite
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Dynamic profile creation for users who register/sign in through Firebase first
      const userCount = await prisma.user.count();
      const role = userCount === 0 ? "ADMIN" : "USER";

      user = await prisma.user.create({
        data: {
          id: uid, // Bind native Firebase UID directly as Primary Key ID
          email,
          passwordHash: "firebase-auth",
          name: name || "Media Member",
          role,
          storageLimit: role === "ADMIN" ? 107374182400 : 5368709120, // Admins 100GB, Users 5GB
        },
      });

      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "USER_REGISTER",
          details: `Registered dynamically via Firebase as ${role}`,
        },
      });
    } else {
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "USER_LOGIN",
          details: "User authenticated successfully via Firebase Auth",
        },
      });
    }

    // 3. Establish local session using compatible JWT token cookies
    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
