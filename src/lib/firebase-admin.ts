import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

export interface FirebaseUserPayload {
  uid: string;
  email: string;
  name: string | null;
  email_verified: boolean;
}

/**
 * Verifies the client's Firebase ID token against Google's public keys.
 * This runs securely in Next.js backend and does NOT require service account JSON credentials.
 */
export async function verifyFirebaseToken(idToken: string): Promise<FirebaseUserPayload> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable is missing.");
  }

  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });

    return {
      uid: payload.sub as string,
      email: payload.email as string,
      name: (payload.name as string) || null,
      email_verified: payload.email_verified as boolean,
    };
  } catch (error: any) {
    console.error("Firebase ID Token validation error:", error);
    throw new Error(`Token verification failed: ${error.message || error}`);
  }
}
