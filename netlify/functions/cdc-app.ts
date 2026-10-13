/* API de l'espace équipe : session obligatoire sur toutes les routes. */
import type { Config } from "@netlify/functions";
import { checkWrite, err, guard, json, readJson, requireSession } from "./_lib/http.ts";
import { createCdc, deleteCdc, deleteToken, getCdc, listCdc, setTokenOwner, updateCdc } from "./_lib/storage.ts";
import { newId, newToken, sha256 } from "./_lib/crypto.ts";
import { toDocx } from "./_lib/docx.ts";
import { DEFAULTS, summarize, toView, type Cdc } from "../../shared/model.ts";
import { fileName } from "../../shared/exports.ts";
import { ID_RE, parseCreate, parsePatch, type CdcPatch } from "../../shared/validate.ts";

/** Applique un patch équipe. Un champ modifié par l'équipe n'est plus « rempli par le client ». */
export function applyTeamPatch(c: Cdc, p: CdcPatch): Cdc {
  const clientFilled = { ...c.clientFilled };
  for (const k of [...Object.keys(p.f ?? {}), ...Object.keys(p.checks ?? {})]) {
    const changed = p.f && k in p.f ? p.f[k] !== (c.f[k] ?? "") : p.checks ? p.checks[k] !== !!c.checks[k] : false;
    if (changed) delete clientFilled[k];
  }
  return {
    ...c,
    name: p.name ?? c.name,
    status: p.status ?? c.status,
    woo: p.woo ?? c.woo,
    f: { ...c.f, ...p.f },
    checks: { ...c.checks, ...p.checks },
    clientFilled,
    updatedAt: Date.now(),
  };
}

export default (req: Request) =>
  guard(async () => {
    const denied = requireSession(req);
    if (denied) return denied;
    const bad = checkWrite(req);
    if (bad) return bad;

    const parts = new URL(req.url).pathname.replace(/\/+$/, "").split("/").slice(4); // après /api/app/cdc
    const [id, sub, sub2] = parts;
    if (id && !ID_RE.test(id)) return err(404, "Introuvable");

    if (!id) {
      if (req.method === "GET") return json((await listCdc()).map(summarize));
      if (req.method === "POST") {
        const p = parseCreate(await readJson(req));
        const now = Date.now();
        const cdc: Cdc = {
          id: newId(), name: p.name ?? "Nouveau client", status: p.status ?? "rdv", woo: p.woo ?? false,
          f: { ...DEFAULTS, ...p.f }, checks: { ...p.checks }, clientFilled: {}, share: null, createdAt: now, updatedAt: now,
        };
        await createCdc(cdc);
        return json(toView(cdc), 201);
      }
      return err(405, "Méthode non autorisée");
    }

    if (!sub) {
      if (req.method === "GET") {
        const c = await getCdc(id);
        return c ? json(toView(c)) : err(404, "Introuvable");
      }
      if (req.method === "PATCH") {
        const p = parsePatch(await readJson(req));
        const c = await updateCdc(id, (cur) => applyTeamPatch(cur, p));
        return c ? json(toView(c)) : err(404, "Introuvable");
      }
      if (req.method === "DELETE") {
        const c = await getCdc(id);
        if (!c) return err(404, "Introuvable");
        if (c.share) await deleteToken(c.share.tokenHash);
        await deleteCdc(id);
        return json({ ok: true });
      }
      return err(405, "Méthode non autorisée");
    }

    if (sub === "share") {
      if (req.method === "POST") {
        const cur = await getCdc(id);
        if (!cur) return err(404, "Introuvable");
        if (cur.share) await deleteToken(cur.share.tokenHash); // régénérer = révoquer l'ancien lien
        const token = newToken();
        const tokenHash = sha256(token);
        await setTokenOwner(tokenHash, id);
        await updateCdc(id, (c) => ({ ...c, share: { tokenHash, createdAt: Date.now() } }));
        const origin = new URL(req.url).origin;
        return json({ url: `${origin}/c/${token}` }, 201); // le jeton n'est montré qu'une fois
      }
      if (req.method === "DELETE") {
        const cur = await getCdc(id);
        if (!cur) return err(404, "Introuvable");
        if (cur.share) await deleteToken(cur.share.tokenHash);
        await updateCdc(id, (c) => ({ ...c, share: null }));
        return json({ ok: true });
      }
      return err(405, "Méthode non autorisée");
    }

    if (sub === "export.docx" && req.method === "GET") {
      const c = await getCdc(id);
      if (!c) return err(404, "Introuvable");
      const buf = await toDocx(c);
      return new Response(new Uint8Array(buf), {
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "content-disposition": `attachment; filename="${fileName(c, "docx")}"`,
          "cache-control": "no-store",
        },
      });
    }
    void sub2;
    return err(404, "Route inconnue");
  });

export const config: Config = { path: ["/api/app/cdc", "/api/app/cdc/*"] };
