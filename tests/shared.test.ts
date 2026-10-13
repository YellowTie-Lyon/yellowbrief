import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENT_FIELD_KEYS, PAGES, pagePct, type Cdc } from "../shared/model.ts";
import { ValidationError, parsePatch } from "../shared/validate.ts";
import { toBrief, toMarkdown } from "../shared/exports.ts";

const cdc = (f: Record<string, string> = {}, extra: Partial<Cdc> = {}): Cdc => ({
  id: "x", name: "n", status: "rdv", woo: false, f, checks: {}, clientFilled: {}, share: null, createdAt: 1, updatedAt: 1, ...extra,
});

test("les champs internes ne sont jamais accessibles au client", () => {
  for (const k of ["rq_projet", "acces", "livraison", "offre", "domaine_choisi", "maquette_lien", "maquette_validee", "date_contenus"]) {
    assert.ok(!CLIENT_FIELD_KEYS.has(k), k);
  }
  assert.ok(CLIENT_FIELD_KEYS.has("activite"));
});

test("validation : le client ne peut pas modifier statut ni champs internes", () => {
  assert.throws(() => parsePatch({ status: "enligne" }, true), ValidationError);
  assert.throws(() => parsePatch({ f: { rq_projet: "x" } }, true), ValidationError);
  assert.throws(() => parsePatch({ f: { inconnu: "x" } }), ValidationError);
  assert.throws(() => parsePatch({ f: { activite: 12 } }), ValidationError);
  assert.throws(() => parsePatch({ f: { activite: "a".repeat(10_001) } }), ValidationError);
  assert.deepEqual(parsePatch({ f: { activite: "ok\u0000\r\nligne" } }, true).f, { activite: "ok\nligne" });
});

test("pourcentage : exclut les remarques et WooCommerce désactivé", () => {
  const p = PAGES[0];
  assert.equal(pagePct(cdc(), p), 0);
  assert.ok(pagePct(cdc({ entreprise: "A" }), p) > 0);
  assert.equal(pagePct(cdc({ rq_client: "x" }), p), 0);
});

test("exports : brief et markdown", () => {
  const c = cdc({ entreprise: "Dupont", activite: "Pain" }, { checks: { c_logo: true } });
  assert.match(toBrief(c), /site vitrine pour Dupont/);
  assert.match(toBrief({ ...c, woo: true }), /e-commerce/);
  const md = toMarkdown(c);
  assert.match(md, /# Cahier des charges – Dupont/);
  assert.match(md, /- \[x\] Logo/);
  assert.match(md, /\*\*Description de l'activité :\*\* Pain/);
});
