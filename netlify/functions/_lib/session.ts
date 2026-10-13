/* Session d'équipe : cookie HttpOnly signé HMAC-SHA256 (SESSION_SECRET), 30 jours. */
import { env } from "./env.ts";
import { hmac, safeEqual } from "./crypto.ts";

export const COOKIE = "yb_session";
export const SESSION_MS = 30 * 24 * 3600 * 1000;

export function createSessionCookie(req: Request): string {
  const exp = Date.now() + SESSION_MS;
  const payload = Buffer.from(JSON.stringify({ exp, n: Math.random().toString(36).slice(2) })).toString("base64url");
  const sig = hmac(env("SESSION_SECRET"), payload);
  return cookieString(`${payload}.${sig}`, SESSION_MS / 1000, req);
}

export function clearSessionCookie(req: Request): string {
  return cookieString("", 0, req);
}

function cookieString(value: string, maxAge: number, req: Request): string {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function hasValidSession(req: Request): boolean {
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return false;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!payload || !sig) return false;
  try {
    if (!safeEqual(sig, hmac(env("SESSION_SECRET"), payload))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
