import type { Config, Context } from "@netlify/functions";
import { env } from "./_lib/env.ts";
import { safeEqual } from "./_lib/crypto.ts";
import { clearSessionCookie, createSessionCookie, hasValidSession } from "./_lib/session.ts";
import { lockedFor, recordFailure, recordSuccess } from "./_lib/ratelimit.ts";
import { checkWrite, clientIp, err, guard, json, readJson } from "./_lib/http.ts";

export default (req: Request, ctx: Context) =>
  guard(async () => {
    const path = new URL(req.url).pathname.replace(/\/+$/, "");
    const bad = checkWrite(req);
    if (bad) return bad;

    if (path === "/api/auth/me" && req.method === "GET") {
      return json({ authenticated: hasValidSession(req) });
    }
    if (path === "/api/auth/logout" && req.method === "POST") {
      return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(req) });
    }
    if (path === "/api/auth/login" && req.method === "POST") {
      const ip = clientIp(req, ctx);
      const wait = await lockedFor(ip);
      if (wait) return err(429, `Trop de tentatives. Réessayez dans ${Math.ceil(wait / 60)} min.`, { "retry-after": String(wait) });
      const body = (await readJson(req)) as { password?: unknown } | undefined;
      const pwd = typeof body?.password === "string" ? body.password : "";
      if (!pwd || !safeEqual(pwd, env("TEAM_PASSWORD"))) {
        await recordFailure(ip);
        return err(401, "Mot de passe incorrect");
      }
      await recordSuccess(ip);
      return json({ ok: true }, 200, { "set-cookie": createSessionCookie(req) });
    }
    return err(404, "Route inconnue");
  });

export const config: Config = { path: "/api/auth/*" };
