/* Espace équipe YellowBrief : connexion, liste, édition avec sauvegarde automatique, lien client, exports. */
import {
  PAGES, STATUSES, statusLabel, pagePct,
  type CdcSummary, type CdcView, type StatusKey,
} from "../shared/model.ts";
import { fmtDate, toBrief, toMarkdown, fileName } from "../shared/exports.ts";
import { mountThemeToggle } from "./theme.ts";
import { $, FOOTER_HTML, esc, fieldHTML, toast, visibleGroups } from "./ui.ts";

/* ---------- API ---------- */
class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : method === "GET" ? {} : { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : method === "GET" ? undefined : "{}",
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/login")) showLogin();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Erreur");
  return data as T;
}

/* ---------- État ---------- */
type Patch = { f?: Record<string, string>; checks?: Record<string, boolean>; status?: StatusKey; woo?: boolean; name?: string };
let docs: CdcSummary[] = [];
let current: CdcView | null = null;
let activeTab = "client";
let filter = "all";
let query = "";
let pending: Patch = {};
let saveTimer: number | undefined;
let saving: Promise<void> = Promise.resolve();
let shareUrl: string | null = null;
let shareConfirm: "revoke" | null = null;
let delAsk = false;
let pollTimer: number | undefined;

/* ---------- Connexion ---------- */
function showLogin() {
  clearInterval(pollTimer);
  current = null;
  $("#app").hidden = true;
  $("#login").hidden = false;
  $("#newBtn").hidden = true;
  $("#logoutBtn").hidden = true;
}
async function showApp() {
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#newBtn").hidden = false;
  $("#logoutBtn").hidden = false;
  await loadList();
  clearInterval(pollTimer);
  pollTimer = window.setInterval(poll, 20000);
}
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>("#pwd");
  $("#loginErr").textContent = "";
  try {
    await api("POST", "/api/auth/login", { password: input.value });
    input.value = "";
    await showApp();
  } catch (err) {
    $("#loginErr").textContent = (err as Error).message;
  }
});
$("#logoutBtn").addEventListener("click", async () => {
  await api("POST", "/api/auth/logout").catch(() => {});
  showLogin();
});

/* ---------- Liste ---------- */
async function loadList() {
  try {
    docs = await api<CdcSummary[]>("GET", "/api/app/cdc");
    $("#dbnote").textContent = "";
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) $("#dbnote").textContent = "Connexion interrompue : rechargez la page";
    return;
  }
  renderList();
}
function renderFilters() {
  const counts: Record<string, number> = { all: docs.length };
  STATUSES.forEach(([k]) => (counts[k] = docs.filter((d) => d.status === k).length));
  $("#filters").innerHTML = ([["all", "Tous"], ...STATUSES] as const)
    .map(([k, l]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${filter === k}">${l} · ${counts[k] ?? 0}</button>`).join("");
}
function renderList() {
  renderFilters();
  const q = query.trim().toLowerCase();
  const list = docs.filter((d) => (filter === "all" || d.status === filter) && (!q || `${d.entreprise || d.name} ${d.domaine}`.toLowerCase().includes(q)));
  const box = $("#projs");
  if (!docs.length) { box.innerHTML = `<div class="empty">Aucun cahier des charges pour l'instant.<br>Créez le premier avec « Nouveau cahier des charges ».</div>`; return; }
  if (!list.length) { box.innerHTML = `<div class="empty">Aucun résultat.</div>`; return; }
  box.innerHTML = list.map((d) => `<button type="button" class="proj" data-id="${esc(d.id)}" aria-current="${d.id === current?.id}">
    <span class="n">${esc(d.entreprise || d.name || "Sans nom")}</span><span class="pill s-${esc(d.status)}">${statusLabel(d.status)}</span>
    <span class="d">${d.livraison ? "Livraison : " + esc(d.livraison) + " · " : ""}modifié ${fmtDate(d.updatedAt)}${d.hasClientEdits ? " · ✎ client" : ""}</span></button>`).join("");
}
$("#q").addEventListener("input", (e) => { query = (e.target as HTMLInputElement).value; renderList(); });

/* ---------- Fiche ---------- */
function renderTabs() {
  if (!current) return;
  const c = current;
  $("#tabs").innerHTML = PAGES.map((p) => `<button type="button" class="tab" role="tab" id="tab_${p.id}" data-tab="${p.id}" aria-selected="${activeTab === p.id}">${p.title} <span class="pct">${pagePct(c, p)} %</span></button>`).join("") +
    `<button type="button" class="tab" role="tab" data-tab="export" aria-selected="${activeTab === "export"}">Export</button>`;
}
function renderShare() {
  if (!current) return;
  const box = $("#share");
  const s = current.share;
  if (shareUrl) {
    box.innerHTML = `<div><strong>Lien client</strong> : copiez-le maintenant, il ne sera plus affiché ensuite.</div>
      <div class="row"><input type="text" id="shareUrl" readonly value="${esc(shareUrl)}" aria-label="Lien client"><button type="button" class="btn small primary" data-act="copyShare">Copier le lien</button></div>
      <div class="row"><button type="button" class="btn small" data-act="shareDone">J'ai copié le lien</button></div>`;
  } else if (s) {
    box.innerHTML = `<div><strong>Lien client actif</strong> depuis le ${fmtDate(s.createdAt)}${s.lastClientEditAt ? " · dernière saisie du client le " + fmtDate(s.lastClientEditAt) : " · aucune saisie du client pour l'instant"}.</div>
      ${shareConfirm === "revoke"
        ? `<div class="confirm">Révoquer le lien ? Le client ne pourra plus y accéder. <button type="button" class="btn danger small" data-act="revokeYes">Révoquer</button><button type="button" class="btn small" data-act="revokeNo">Annuler</button></div>`
        : `<div class="row"><button type="button" class="btn small" data-act="regen">Générer un nouveau lien</button><button type="button" class="btn small danger" data-act="revokeAsk">Révoquer le lien</button></div>`}`;
  } else {
    box.innerHTML = `<div class="row"><button type="button" class="btn small" data-act="gen">Générer un lien client</button><span class="note">Le client remplit une version simplifiée, sans les champs internes.</span></div>`;
  }
}
function renderDelete() {
  $("#delbox").innerHTML = delAsk
    ? `<div class="confirm">Supprimer définitivement ce cahier des charges ? <button type="button" class="btn danger" data-act="delYes">Supprimer</button><button type="button" class="btn" data-act="delNo">Annuler</button></div>`
    : `<button type="button" class="btn danger" data-act="delAsk">Supprimer ce cahier des charges</button>`;
}
function pageHTML(p: (typeof PAGES)[number]): string {
  const c = current!;
  return `<h2 class="page-title">${p.title}</h2>` + visibleGroups(p, false).map((g) => {
    if (g.woo) {
      return `<div class="toggle-woo"><label class="check"><input type="checkbox" id="woo" ${c.woo ? "checked" : ""}> Boutique en ligne (WooCommerce)</label></div>` +
        (c.woo ? `<div class="group"><h3>${g.title} :</h3><div class="fields">${g.fields!.map((f) => fieldHTML(f, { value: c.f[f[0]] ?? "", client: false, byClient: !!c.clientFilled[f[0]] })).join("")}</div></div>` : "");
    }
    return `<div class="group">${g.title ? `<h3>${g.title} :</h3>` : ""}
      ${g.checks ? `<div class="checks">${g.checks.map(([k, l]) => `<label class="check"><input type="checkbox" data-c="${k}" ${c.checks[k] ? "checked" : ""}> ${esc(l)}${c.clientFilled[k] ? ` <span class="badge-client" data-badge="${k}">Rempli par le client</span>` : ""}</label>`).join("")}</div>` : ""}
      <div class="fields">${(g.fields ?? []).map((f) => fieldHTML(f, { value: c.f[f[0]] ?? "", client: false, byClient: !!c.clientFilled[f[0]] })).join("")}</div></div>`;
  }).join("");
}
function renderEditor() {
  if (!current) { $("#editor").hidden = true; $("#welcome").hidden = false; return; }
  const c = current;
  $("#welcome").hidden = true;
  $("#editor").hidden = false;
  $("#title").textContent = c.f.entreprise || c.name || "Nouveau client";
  $("#status").innerHTML = STATUSES.map(([k, l]) => `<option value="${k}" ${c.status === k ? "selected" : ""}>${l}</option>`).join("");
  renderTabs();
  renderShare();
  $("#pages").innerHTML = PAGES.map((p) => `<section class="page ${activeTab === p.id ? "on" : ""}" role="tabpanel" aria-labelledby="tab_${p.id}" data-page="${p.id}">${pageHTML(p)}</section>`).join("") +
    `<section class="page ${activeTab === "export" ? "on" : ""}" data-page="export">${activeTab === "export" ? exportHTML() : ""}</section>`;
  renderDelete();
}

/* ---------- Export ---------- */
function exportHTML(): string {
  const c = current!;
  return `<h2 class="page-title">Export</h2><div class="export">
   <div class="card"><h3>Brief maquette Emergent</h3><p>À coller dans Emergent pour générer la maquette à partir de ce cahier des charges.</p>
    <pre id="briefTxt" tabindex="0">${esc(toBrief(c))}</pre><div class="row"><button type="button" class="btn primary" data-copy="briefTxt">Copier le brief</button></div></div>
   <div class="card"><h3>Cahier des charges pour Claude</h3><p>Format Markdown, à coller dans une conversation ou à joindre au projet client.</p>
    <pre id="mdTxt" tabindex="0">${esc(toMarkdown(c))}</pre><div class="row"><button type="button" class="btn primary" data-copy="mdTxt">Copier</button><button type="button" class="btn" data-act="dlMd">Télécharger (.md)</button></div></div>
   <div class="card"><h3>Document Word (.docx)</h3><p>Reprend la mise en page OneNote de l'agence, une page par section : à importer dans OneNote.</p>
    <div class="row"><button type="button" class="btn primary" data-act="dlDocx">Télécharger (.docx)</button></div></div>
  </div>`;
}
function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Sauvegarde automatique ---------- */
const setSaved = (t: string) => ($("#saved").textContent = t);
function queueSave(p: Patch) {
  pending = { ...pending, ...p, f: { ...pending.f, ...p.f }, checks: { ...pending.checks, ...p.checks } };
  if (!Object.keys(pending.f!).length) delete pending.f;
  if (!Object.keys(pending.checks!).length) delete pending.checks;
  setSaved("Enregistrement…");
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 600);
}
function flush(): Promise<void> {
  clearTimeout(saveTimer);
  saving = saving.then(async () => {
    if (!current || !Object.keys(pending).length) return;
    const id = current.id;
    const patch = pending;
    pending = {};
    try {
      const saved = await api<CdcView>("PATCH", `/api/app/cdc/${id}`, patch);
      if (current?.id === id) {
        current.updatedAt = saved.updatedAt;
        current.clientFilled = saved.clientFilled;
        current.share = saved.share;
        setSaved("Enregistré");
      }
      const d = docs.find((x) => x.id === id);
      if (d) { d.updatedAt = saved.updatedAt; d.status = saved.status; d.entreprise = saved.f.entreprise ?? ""; d.hasClientEdits = Object.keys(saved.clientFilled).length > 0; d.livraison = saved.f.livraison ?? ""; d.domaine = saved.f.domaine_choisi ?? ""; renderList(); }
    } catch (e) {
      // on remet les modifications en file sans écraser les plus récentes
      pending = { ...patch, ...pending, f: { ...patch.f, ...pending.f }, checks: { ...patch.checks, ...pending.checks } };
      if (e instanceof ApiError && e.status === 400) { setSaved("Refusé : " + e.message); pending = {}; return; }
      setSaved("Échec : nouvelle tentative…");
      saveTimer = window.setTimeout(flush, 4000);
    }
  });
  return saving;
}
window.addEventListener("beforeunload", (e) => { if (Object.keys(pending).length) { e.preventDefault(); } });

/* ---------- Rafraîchissement (saisies du client, autres membres de l'équipe) ---------- */
function updateBadges() {
  if (!current) return;
  const c = current;
  document.querySelectorAll<HTMLElement>(".field").forEach((w) => {
    const el = w.querySelector<HTMLElement>("[data-k]");
    if (!el) return;
    const k = el.dataset.k!;
    const by = !!c.clientFilled[k];
    w.classList.toggle("by-client", by);
    const lab = w.querySelector("label:not(.hint)");
    const has = w.querySelector(".badge-client");
    if (by && !has && lab) lab.insertAdjacentHTML("beforeend", `<span class="badge-client" data-badge="${k}">Rempli par le client</span>`);
    if (!by && has) has.remove();
  });
  document.querySelectorAll<HTMLElement>("label.check").forEach((l) => {
    const inp = l.querySelector<HTMLInputElement>("[data-c]");
    if (!inp) return;
    const by = !!c.clientFilled[inp.dataset.c!];
    const has = l.querySelector(".badge-client");
    if (by && !has) l.insertAdjacentHTML("beforeend", ` <span class="badge-client" data-badge="${inp.dataset.c}">Rempli par le client</span>`);
    if (!by && has) has.remove();
  });
}
async function poll() {
  if (document.hidden) return;
  await loadList();
  if (!current || Object.keys(pending).length) return;
  try {
    const srv = await api<CdcView>("GET", `/api/app/cdc/${current.id}`);
    if (Object.keys(pending).length) return;
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.k;
    let wooChanged = srv.woo !== current.woo;
    for (const [k, v] of Object.entries(srv.f)) {
      if (k === focused || current.f[k] === v) continue;
      current.f[k] = v;
      const el = document.getElementById("f_" + k) as HTMLInputElement | null;
      if (el) el.value = v;
    }
    for (const [k, v] of Object.entries(srv.checks)) {
      current.checks[k] = v;
      const el = document.querySelector<HTMLInputElement>(`[data-c="${k}"]`);
      if (el) el.checked = v;
    }
    current.clientFilled = srv.clientFilled;
    current.share = srv.share;
    current.updatedAt = srv.updatedAt;
    current.status = srv.status;
    current.woo = srv.woo;
    ($("#status") as HTMLSelectElement).value = srv.status;
    if (wooChanged) renderEditor(); else { updateBadges(); renderTabs(); if (!shareUrl) renderShare(); }
  } catch { /* silencieux : le prochain cycle réessaiera */ }
}

/* ---------- Événements ---------- */
document.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (!current || !t.dataset?.k) return;
  const k = t.dataset.k;
  current.f[k] = t.value;
  queueSave({ f: { [k]: t.value } });
  if (current.clientFilled[k]) { delete current.clientFilled[k]; updateBadges(); }
  if (k === "entreprise") $("#title").textContent = t.value || "Nouveau client";
  const pg = PAGES.find((p) => p.id === activeTab);
  const pct = document.querySelector(`.tab[data-tab="${activeTab}"] .pct`);
  if (pg && pct) pct.textContent = pagePct(current, pg) + " %";
});
document.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement | HTMLSelectElement;
  if (!current) return;
  if (t.id === "status") { current.status = t.value as StatusKey; queueSave({ status: current.status }); const d = docs.find((x) => x.id === current!.id); if (d) d.status = current.status; renderList(); }
  const cb = t as HTMLInputElement;
  if (cb.dataset?.c) { current.checks[cb.dataset.c] = cb.checked; delete current.clientFilled[cb.dataset.c]; queueSave({ checks: { [cb.dataset.c]: cb.checked } }); updateBadges(); }
  if (t.id === "woo") { current.woo = cb.checked; queueSave({ woo: cb.checked }); renderEditor(); }
});

document.addEventListener("click", async (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  const act = b.dataset.act;
  if (b.dataset.f) { filter = b.dataset.f; renderList(); return; }
  if (b.dataset.id) { await openDoc(b.dataset.id); return; }
  if (b.dataset.tab) { activeTab = b.dataset.tab; if (activeTab === "export") await flush(); renderEditor(); return; }
  if (b.id === "newBtn") { await createNew(); return; }
  if (b.dataset.copy) {
    const el = document.getElementById(b.dataset.copy)!;
    try { await navigator.clipboard.writeText(el.textContent ?? ""); toast("Copié"); }
    catch { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection()!; s.removeAllRanges(); s.addRange(r); toast("Texte sélectionné : Ctrl+C pour copier"); }
    return;
  }
  if (!act || !current) return;
  const id = current.id;
  try {
    switch (act) {
      case "dlMd": download(new Blob([toMarkdown(current)], { type: "text/markdown;charset=utf-8" }), fileName(current, "md")); toast("Fichier enregistré"); break;
      case "dlDocx": {
        await flush();
        const res = await fetch(`/api/app/cdc/${id}/export.docx`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Export Word impossible");
        download(await res.blob(), fileName(current, "docx")); toast("Fichier enregistré"); break;
      }
      case "gen": case "regen": {
        const r = await api<{ url: string }>("POST", `/api/app/cdc/${id}/share`);
        shareUrl = r.url; current.share = { createdAt: Date.now() }; renderShare(); $<HTMLInputElement>("#shareUrl").select(); break;
      }
      case "copyShare": {
        const v = $<HTMLInputElement>("#shareUrl").value;
        try { await navigator.clipboard.writeText(v); toast("Lien copié"); } catch { $<HTMLInputElement>("#shareUrl").select(); toast("Lien sélectionné : Ctrl+C pour copier"); }
        break;
      }
      case "shareDone": shareUrl = null; renderShare(); break;
      case "revokeAsk": shareConfirm = "revoke"; renderShare(); break;
      case "revokeNo": shareConfirm = null; renderShare(); break;
      case "revokeYes": await api("DELETE", `/api/app/cdc/${id}/share`); shareConfirm = null; shareUrl = null; current.share = null; renderShare(); toast("Lien révoqué"); loadList(); break;
      case "delAsk": delAsk = true; renderDelete(); break;
      case "delNo": delAsk = false; renderDelete(); break;
      case "delYes":
        pending = {}; clearTimeout(saveTimer);
        await api("DELETE", `/api/app/cdc/${id}`);
        delAsk = false; docs = docs.filter((d) => d.id !== id); current = null; renderList(); renderEditor(); toast("Cahier des charges supprimé"); break;
    }
  } catch (err) { toast((err as Error).message || "Action impossible"); }
});

async function openDoc(id: string) {
  await flush();
  try {
    current = await api<CdcView>("GET", `/api/app/cdc/${id}`);
  } catch { toast("Ouverture impossible"); return; }
  shareUrl = null; shareConfirm = null; delAsk = false; setSaved("");
  renderList(); renderEditor();
  if (innerWidth < 900) $("#sheet").scrollIntoView({ behavior: "smooth" });
}
async function createNew() {
  try {
    const c = await api<CdcView>("POST", "/api/app/cdc", {});
    docs.unshift({ id: c.id, name: c.name, entreprise: "", domaine: "", livraison: "", status: c.status, updatedAt: c.updatedAt, hasShare: false, hasClientEdits: false, pct: {} });
    activeTab = "client";
    await openDoc(c.id);
    setTimeout(() => document.getElementById("f_entreprise")?.focus(), 50);
  } catch { toast("Création impossible, réessayez"); }
}

/* ---------- Démarrage ---------- */
$("#foot").innerHTML = FOOTER_HTML;
mountThemeToggle($<HTMLButtonElement>("#themeBtn"));
(async () => {
  try {
    const me = await api<{ authenticated: boolean }>("GET", "/api/auth/me");
    if (me.authenticated) await showApp(); else showLogin();
  } catch { showLogin(); }
})();
