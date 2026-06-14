import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "vividgallery-secret-key-super-secure-change-in-prod";
const KEY = new TextEncoder().encode(JWT_SECRET);

export interface JWTSessionPayload {
  userId: string;
  email: string;
  role: string;
  name?: string | null;
}

export async function signJWTToken(payload: JWTSessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(KEY);
}

export async function verifyJWTToken(token: string): Promise<JWTSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, KEY, {
      algorithms: ["HS256"],
    });
    return payload as unknown as JWTSessionPayload;
  } catch (error) {
    return null;
  }
}

export async function createSession(payload: JWTSessionPayload) {
  const token = await signJWTToken(payload);
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
  });
  return token;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function getSession(): Promise<JWTSessionPayload | null> {
  if (typeof globalThis !== "undefined" && (globalThis as any).mockSession) {
    return (globalThis as any).mockSession;
  }
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) return null;
    return await verifyJWTToken(token);
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(req: NextRequest): Promise<JWTSessionPayload | null> {
  try {
    const token = req.cookies.get("session")?.value;
    if (!token) return null;
    return await verifyJWTToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextRequest): Promise<JWTSessionPayload> {
  const session = await getSessionFromRequest(req);
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin(req: NextRequest): Promise<JWTSessionPayload> {
  const session = await requireAuth(req);
  if (session.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}
