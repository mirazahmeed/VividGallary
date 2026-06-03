import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyFirebaseToken } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { idToken, name } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Firebase ID token is required" },
        { status: 400 }
      );
    }

    // 1. Verify the client-side Firebase ID Token on server-side
    const firebaseUser = await verifyFirebaseToken(idToken);
    const { uid, email, name: firebaseName } = firebaseUser;

    // 2. Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // User is already registered locally; establish session (login fallback)
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
    }

    // 3. Create the user record in SQLite with Firebase UID as primary key
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "ADMIN" : "USER";

    user = await prisma.user.create({
      data: {
        id: uid, // Bind Firebase UID directly
        email,
        passwordHash: "firebase-auth",
        name: name || firebaseName || "Media Member",
        role,
        storageLimit: role === "ADMIN" ? 107374182400 : 5368709120, // Admins 100GB, Users 5GB
      },
    });

    // 4. Create local session using compatible JWT token cookies
    await createSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Log the registration activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "USER_REGISTER",
        details: `Registered via Firebase as ${role}`,
      },
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
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during registration" },
      { status: 500 }
    );
  }
}
