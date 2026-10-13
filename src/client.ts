/* Page client : version simplifiée du cahier des charges, accessible par jeton. */
import { PAGES } from "../shared/model.ts";
import { mountThemeToggle } from "./theme.ts";
import { $, FOOTER_HTML, esc, fieldHTML, toast, visibleGroups } from "./ui.ts";

interface ClientData { entreprise: string; woo: boolean; f: Record<string, string>; checks: Record<string, boolean> }
const token = location.pathname.split("/").filter(Boolean)[1] ?? "";
let data: ClientData | null = null;
let activeTab = PAGES[0].id as string;
let pending: { f: Record<string, string>; checks: Record<string, boolean> } = { f: {}, checks: {} };
let saveTimer: number | undefined;
let saving: Promise<void> = Promise.resolve();

const setSaved = (t: string) => ($("#saved").textContent = t);
/* Sur la page client, les champs internes ne comptent pas dans le pourcentage. */
function clientPct(p: (typeof PAGES)[number]): number {
  const fs = visibleGroups(p, true).filter((g) => !g.woo || data!.woo).flatMap((g) => g.fields ?? []).filter((f) => !f[0].startsWith("rq_"));
  const done = fs.filter((f) => (data!.f[f[0]] ?? "").trim()).length;
  return fs.length ? Math.round((done * 100) / fs.length) : 0;
}

function renderTabs() {
  $("#tabs").innerHTML = PAGES.filter((p) => visibleGroups(p, true).length).map((p) =>
    `<button type="button" class="tab" role="tab" id="tab_${p.id}" data-tab="${p.id}" aria-selected="${activeTab === p.id}">${p.title} <span class="pct">${clientPct(p)} %</span></button>`).join("");
}
function render() {
  const d = data!;
  $("#title").textContent = d.entreprise ? `Cahier des charges – ${d.entreprise}` : "Votre cahier des charges";
  renderTabs();
  $("#pages").innerHTML = PAGES.map((p) => `<section class="page ${activeTab === p.id ? "on" : ""}" role="tabpanel" aria-labelledby="tab_${p.id}"><h2 class="page-title">${p.title}</h2>` +
    visibleGroups(p, true).map((g) => {
      if (g.woo && !d.woo) return "";
      const fields = (g.fields ?? []).map((f) => fieldHTML(f, { value: d.f[f[0]] ?? "", client: true })).join("");
      const checks = g.checks ? `<div class="checks">${g.checks.map(([k, l]) => `<label class="check"><input type="checkbox" data-c="${k}" ${d.checks[k] ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div>` : "";
      if (!fields && !checks) return "";
      return `<div class="group">${g.title ? `<h3>${g.title} :</h3>` : ""}${checks}${fields ? `<div class="fields">${fields}</div>` : ""}</div>`;
    }).join("") + `</section>`).join("");
}

function queueSave() {
  setSaved("Enregistrement…");
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flush, 800);
}
function flush(): Promise<void> {
  clearTimeout(saveTimer);
  saving = saving.then(async () => {
    if (!Object.keys(pending.f).length && !Object.keys(pending.checks).length) return;
    const patch = pending;
    pending = { f: {}, checks: {} };
    try {
      const res = await fetch(`/api/client/${token}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Erreur");
      setSaved("Enregistré ✓");
    } catch (e) {
      pending = { f: { ...patch.f, ...pending.f }, checks: { ...patch.checks, ...pending.checks } };
      setSaved("Échec : nouvelle tentative…");
      toast((e as Error).message);
      saveTimer = window.setTimeout(flush, 5000);
    }
  });
  return saving;
}
window.addEventListener("beforeunload", (e) => { if (Object.keys(pending.f).length || Object.keys(pending.checks).length) e.preventDefault(); });

document.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (!data || !t.dataset?.k) return;
  data.f[t.dataset.k] = t.value;
  pending.f[t.dataset.k] = t.value;
  queueSave();
  const p = PAGES.find((x) => x.id === activeTab);
  const el = document.querySelector(`.tab[data-tab="${activeTab}"] .pct`);
  if (p && el) el.textContent = clientPct(p) + " %";
});
document.addEventListener("change", (e) => {
  const t = e.target as HTMLInputElement;
  if (!data || !t.dataset?.c) return;
  data.checks[t.dataset.c] = t.checked;
  pending.checks[t.dataset.c] = t.checked;
  queueSave();
});
document.addEventListener("click", async (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  if (b.dataset.tab) { activeTab = b.dataset.tab; render(); return; }
  if (b.id === "saveBtn") { await flush(); toast(document.getElementById("saved")!.textContent?.startsWith("Enregistré") ? "Vos réponses sont enregistrées. Merci !" : "Enregistrement en cours…"); }
});

$("#foot").innerHTML = FOOTER_HTML;
mountThemeToggle($<HTMLButtonElement>("#themeBtn"));
(async () => {
  try {
    const res = await fetch(`/api/client/${token}`);
    if (!res.ok) throw new Error();
    data = await res.json();
    $("#loading").hidden = true;
    $("#editor").hidden = false;
    render();
  } catch {
    $("#loading").hidden = true;
    $("#invalid").hidden = false;
  }
})();
