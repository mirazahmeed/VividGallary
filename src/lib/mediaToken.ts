import crypto from "crypto";

const STREAM_SECRET = process.env.JWT_SECRET || "vividgallery-secret-key-super-secure-change-in-prod";
const TOKEN_EXPIRY_SECONDS = 5 * 60; // 5 minutes

interface StreamTokenPayload {
  mediaUrl: string;
  userId: string;
  exp: number;
}

/**
 * Generates a signed, time-limited stream token for a media URL.
 * The token encodes the media URL, the requesting user's ID, and an expiry timestamp.
 * It is signed with HMAC-SHA256 to prevent tampering.
 */
export function generateStreamToken(mediaUrl: string, userId: string): string {
  const bucketSize = 5 * 60; // 5 minutes stable window
  const currentEpoch = Math.floor(Date.now() / 1000);
  const exp = (Math.floor(currentEpoch / bucketSize) + 2) * bucketSize;
  const payload: StreamTokenPayload = { mediaUrl, userId, exp };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", STREAM_SECRET)
    .update(payloadStr)
    .digest("base64url");
  return `${payloadStr}.${signature}`;
}

/**
 * Verifies a signed stream token.
 * Returns the decoded payload if valid and not expired, or null otherwise.
 */
export function verifyStreamToken(token: string): StreamTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;

    // Verify HMAC signature
    const expectedSignature = crypto
      .createHmac("sha256", STREAM_SECRET)
      .update(payloadStr)
      .digest("base64url");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    // Decode and parse payload
    const payload: StreamTokenPayload = JSON.parse(
      Buffer.from(payloadStr, "base64url").toString("utf-8")
    );

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
