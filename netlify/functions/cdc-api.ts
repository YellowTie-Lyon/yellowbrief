/* API pour Claude / futur connecteur MCP : Authorization: Bearer <API_TOKEN>. */
import type { Config } from "@netlify/functions";
import { env } from "./_lib/env.ts";
import { safeEqual } from "./_lib/crypto.ts";
import { err, guard, json } from "./_lib/http.ts";
import { getCdc, listCdc } from "./_lib/storage.ts";
import { summarize, toView } from "../../shared/model.ts";
import { toBrief, toMarkdown } from "../../shared/exports.ts";
import { ID_RE } from "../../shared/validate.ts";

export default (req: Request) =>
  guard(async () => {
    if (req.method !== "GET") return err(405, "Méthode non autorisée");
    const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "");
    if (!m || !safeEqual(m[1], env("API_TOKEN"))) return err(401, "Jeton invalide", { "www-authenticate": "Bearer" });

    const url = new URL(req.url);
    const id = url.pathname.replace(/\/+$/, "").split("/")[3];
    const format = url.searchParams.get("format");
    if (format && !["json", "md", "brief"].includes(format)) return err(400, "format invalide (json, md ou brief)");

    if (!id) {
      const all = await listCdc();
      if (format === "md") {
        return new Response(all.map(toMarkdown).join("\n\n---\n\n"), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } });
      }
      return json(all.map(summarize));
    }
    if (!ID_RE.test(id)) return err(404, "Introuvable");
    const c = await getCdc(id);
    if (!c) return err(404, "Introuvable");
    if (format === "md" || format === "brief") {
      return new Response(format === "md" ? toMarkdown(c) : toBrief(c), { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } });
    }
    return json(toView(c));
  });

export const config: Config = { path: ["/api/cdc", "/api/cdc/*"] };
