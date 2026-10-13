/* Thème clair/sombre : suit le système, avec bascule manuelle mémorisée (si le stockage est disponible). */
const KEY = "yb-theme";
const apply = (t: string | null) => {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
};
let saved: string | null = null;
try { saved = localStorage.getItem(KEY); } catch { /* stockage indisponible */ }
apply(saved);

export function mountThemeToggle(btn: HTMLButtonElement) {
  const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const label = () => { btn.textContent = isDark() ? "☀" : "☾"; btn.setAttribute("aria-label", isDark() ? "Passer en thème clair" : "Passer en thème sombre"); };
  label();
  btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    apply(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignoré */ }
    label();
  });
}
