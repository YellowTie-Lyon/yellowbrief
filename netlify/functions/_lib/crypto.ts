import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newId = () => randomUUID();
/** Jeton aléatoire de 256 bits (43 caractères base64url). */
export const newToken = () => randomBytes(32).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("base64url");
