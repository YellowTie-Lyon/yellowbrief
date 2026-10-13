/* Exports texte repris du prototype : brief Emergent et Markdown pour Claude. */
import { PAGES, statusLabel, fieldValue, type Cdc } from "./model.ts";

/** Données nécessaires aux exports (un Cdc ou sa vue sans le jeton). */
export type ExportCdc = Pick<Cdc, "f" | "woo" | "checks" | "status" | "updatedAt">;

export const fmtDate = (ms?: number): string =>
  ms ? new Date(ms).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Paris" }) : "";

export function toMarkdown(c: ExportCdc): string {
  const val = (k: string) => fieldValue(c, k);
  const L: string[] = [
    `# Cahier des charges – ${val("entreprise") || "Client"}`,
    "",
    `Statut : ${statusLabel(c.status)}${c.updatedAt ? " · mis à jour le " + fmtDate(c.updatedAt) : ""}`,
    "",
  ];
  PAGES.forEach((p) => {
    L.push(`## ${p.title}`, "");
    p.groups.forEach((g) => {
      if (g.woo && !c.woo) return;
      const lines: string[] = [];
      (g.checks ?? []).forEach(([k, l]) => lines.push(`- [${c.checks?.[k] ? "x" : " "}] ${l}`));
      (g.fields ?? []).forEach(([k, l]) => {
        const v = val(k);
        if (v) lines.push(v.includes("\n") ? `- **${l} :**\n${v.split("\n").map((x) => "  - " + x).join("\n")}` : `- **${l} :** ${v}`);
      });
      if (lines.length) {
        if (g.title) L.push(`### ${g.title}`, "");
        L.push(...lines, "");
      }
    });
  });
  return L.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function toBrief(c: ExportCdc): string {
  const val = (k: string) => fieldValue(c, k);
  const list = (k: string) => (val(k) ? val(k).split("\n").filter(Boolean).map((x) => "- " + x).join("\n") : "- (à définir)");
  return `Crée la maquette d'un site ${c.woo ? "e-commerce" : "vitrine"} pour ${val("entreprise") || "[client]"}.

Activité : ${val("activite") || "(à compléter)"}
Services / produits : ${val("services") || "(à compléter)"}
Objectifs et cibles : ${val("objectifs") || "(à compléter)"}

Pages du menu :
${list("arborescence")}

Footer :
${list("footer_menu")}

Contenus répétitifs (une page liste + une page détail par élément) : ${val("repetitifs") || "aucun"}
Formulaires : ${val("formulaires") || "formulaire de contact"}
Fonctionnalités : ${[val("specificites"), val("avis") && "avis clients : " + val("avis")].filter(Boolean).join(" ; ") || "aucune particulière"}${c.woo ? "\nBoutique : catalogue, fiche produit, panier, paiement (" + (val("woo_paiement") || "à définir") + ")" : ""}

Design :
- Charte : ${val("charte") || "à proposer"}
- Couleurs : ${val("couleurs") || "à proposer"}
- Polices : ${val("polices") || "Google Fonts au choix"}
- Sites de référence :
${list("references")}

Coordonnées à afficher : ${[val("adresse"), val("telephone"), val("email"), val("horaires")].filter(Boolean).join(" · ") || "(à compléter)"}
Mots-clés : ${val("motscles") || "(à compléter)"}

Contraintes techniques (obligatoires) :
- React + Tailwind, textes en français, ton professionnel.
- Chaque section porte un attribut data-section explicite.
- Fournis un fichier design-tokens.json (couleurs, typographies par taille d'écran, espacements) et un SECTIONS.md qui décrit chaque section et son comportement responsive.
- Responsive soigné en 1440, 768 et 375 px.
- Images libres de droit en attendant les photos du client ; aucun texte de remplissage type lorem ipsum.`;
}

/** Nom de fichier sûr : « CDC-Nom-Client.ext » */
export function fileName(c: Pick<Cdc, "f">, ext: string): string {
  const name = (fieldValue(c, "entreprise") || "client")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `CDC-${name || "client"}.${ext}`;
}
