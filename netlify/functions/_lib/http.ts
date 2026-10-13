import type { Context } from "@netlify/functions";
import { ConfigError } from "./env.ts";
import { hasValidSession } from "./session.ts";
import { ValidationError } from "../../../shared/validate.ts";

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export const err = (status: number, message: string, headers: Record<string, string> = {}) => json({ error: message }, status, headers);

export const clientIp = (req: Request, ctx: Context) => ctx.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";

/** Écritures : Content-Type JSON obligatoire (protège contre les formulaires cross-site) et Origin identique si présent. */
export function checkWrite(req: Request): Response | null {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return null;
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return err(403, "Origine non autorisée");
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return err(415, "Content-Type JSON requis");
  return null;
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 200_000) throw new ValidationError("Requête trop volumineuse");
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { throw new ValidationError("JSON invalide"); }
}

export function requireSession(req: Request): Response | null {
  return hasValidSession(req) ? null : err(401, "Connexion requise");
}

/** Enveloppe commune : convertit les exceptions en réponses JSON. */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ValidationError) return err(400, e.message);
    if (e instanceof ConfigError) { console.error(e.message); return err(500, "Configuration serveur incomplète"); }
    console.error(e);
    return err(500, "Erreur serveur");
  }
}
