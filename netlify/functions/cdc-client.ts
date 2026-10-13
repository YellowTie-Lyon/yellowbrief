/* API du lien client : l'accès est donné par le jeton (hash comparé dans le store « tokens »). */
import type { Config, Context } from "@netlify/functions";
import { checkWrite, clientIp, err, guard, json, readJson } from "./_lib/http.ts";
import { findIdByTokenHash, getRate, setRate, updateCdc, getCdc } from "./_lib/storage.ts";
import { sha256 } from "./_lib/crypto.ts";
import { CLIENT_FIELD_KEYS, fieldValue, type Cdc } from "../../shared/model.ts";
import { TOKEN_RE, parsePatch } from "../../shared/validate.ts";

/** Ne renvoie au client que les champs non internes. */
export function clientView(c: Cdc) {
  return {
    entreprise: fieldValue(c, "entreprise"),
    woo: c.woo,
    f: Object.fromEntries(Object.entries(c.f).filter(([k]) => CLIENT_FIELD_KEYS.has(k))),
    checks: c.checks,
  };
}

export default (req: Request, ctx: Context) =>
  guard(async () => {
    const bad = checkWrite(req);
    if (bad) return bad;
    const token = new URL(req.url).pathname.replace(/\/+$/, "").split("/")[3];
    // limite anti-devinette : 30 jetons invalides par heure et par IP
    const ip = clientIp(req, ctx);
    const rk = "client-" + sha256(ip).slice(0, 32);
    const rs = await getRate(rk);
    if (rs && rs.first + 3600_000 > Date.now() && rs.count >= 30) return err(429, "Trop de tentatives");
    const notFound = async () => {
      const fresh = rs && rs.first + 3600_000 > Date.now();
      await setRate(rk, { count: (fresh ? rs.count : 0) + 1, first: fresh ? rs.first : Date.now() });
      return err(404, "Lien invalide ou révoqué");
    };
    if (!token || !TOKEN_RE.test(token)) return notFound();
    const id = await findIdByTokenHash(sha256(token));
    if (!id) return notFound();

    if (req.method === "GET") {
      const c = await getCdc(id);
      return c ? json(clientView(c)) : notFound();
    }
    if (req.method === "PUT") {
      const p = parsePatch(await readJson(req), true);
      const now = Date.now();
      const c = await updateCdc(id, (cur) => {
        const clientFilled = { ...cur.clientFilled };
        for (const [k, v] of Object.entries(p.f ?? {})) if (v !== (cur.f[k] ?? "")) clientFilled[k] = now;
        for (const [k, v] of Object.entries(p.checks ?? {})) if (v !== !!cur.checks[k]) clientFilled[k] = now;
        return {
          ...cur, f: { ...cur.f, ...p.f }, checks: { ...cur.checks, ...p.checks }, clientFilled, updatedAt: now,
          share: cur.share ? { ...cur.share, lastClientEditAt: now } : cur.share,
        };
      });
      return c ? json({ ok: true, savedAt: now }) : notFound();
    }
    return err(405, "Méthode non autorisée");
  });

export const config: Config = { path: "/api/client/*" };
