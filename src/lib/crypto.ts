import crypto from "crypto";

const SALT = process.env.PASSWORD_SALT || "vividgallery-global-salt-token";

export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 10000, 64, "sha512").toString("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  const incomingHash = hashPassword(password);
  return crypto.timingSafeEqual(
    Buffer.from(incomingHash, "hex"),
    Buffer.from(hash, "hex")
  );
}
