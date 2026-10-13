/* Briques d'interface partagées entre l'espace équipe et la page client. */
import type { Field, Group, Page } from "../shared/model.ts";

export const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

let toastTimer: number | undefined;
export function toast(t: string) {
  const el = $("#toast");
  el.textContent = t;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("on"), 2200);
}

export const FOOTER_HTML = `YellowBrief par <a href="https://yellowtie.fr/" target="_blank" rel="noopener">YellowTie - Agence Web à Lyon</a>`;

export interface FieldCtx {
  value: string;
  client: boolean;      // rendu côté client : consignes NB masquées
  byClient?: boolean;   // champ rempli par le client (marquage côté équipe)
}
export function fieldHTML([k, label, o = {}]: Field, ctx: FieldCtx): string {
  const cls = ["field", o.wide ? "wide" : "", o.cls ?? "", ctx.byClient ? "by-client" : ""].join(" ").trim();
  const input = o.area
    ? `<textarea id="f_${k}" data-k="${k}" rows="3" ${o.hint && !(ctx.client && o.nb) ? `aria-describedby="h_${k}"` : ""}>${esc(ctx.value)}</textarea>`
    : `<input type="text" id="f_${k}" data-k="${k}" value="${esc(ctx.value)}" ${o.hint && !(ctx.client && o.nb) ? `aria-describedby="h_${k}"` : ""}>`;
  const badge = ctx.byClient ? `<span class="badge-client" data-badge="${k}">Rempli par le client</span>` : "";
  const hint = o.hint && !(ctx.client && o.nb) ? `<span class="hint" id="h_${k}">${esc(o.hint)}</span>` : "";
  const lab = o.nolabel ? `<label class="hint" for="f_${k}">Notes libres</label>` : `<label for="f_${k}">${esc(label)} :${badge}</label>`;
  return `<div class="${cls}">${lab}${hint}${input}</div>`;
}

/** Groupes visibles selon le contexte (client : sans groupes internes ni champs internes). */
export function visibleGroups(p: Page, client: boolean): Group[] {
  return p.groups
    .filter((g) => !(client && g.internal))
    .map((g) => (client ? { ...g, fields: g.fields?.filter((f) => !f[2]?.internal) } : g));
}
