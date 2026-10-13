/* Modèle du cahier des charges YellowBrief : partagé entre le front et les fonctions.
   Structure reprise de la constante PAGES du prototype (3 pages comme le OneNote). */

export type StatusKey = "rdv" | "maquette" | "production" | "recette" | "enligne";

export const STATUSES: ReadonlyArray<readonly [StatusKey, string]> = [
  ["rdv", "Rendez-vous"],
  ["maquette", "Maquette"],
  ["production", "Production"],
  ["recette", "Recette"],
  ["enligne", "En ligne"],
];

export const statusLabel = (k: string): string => (STATUSES.find((s) => s[0] === k) ?? STATUSES[0])[1];
export const isStatus = (k: unknown): k is StatusKey => STATUSES.some((s) => s[0] === k);

export interface FieldOpts {
  /** classes de style : key (gras), violet, red */
  cls?: string;
  area?: boolean;
  wide?: boolean;
  nolabel?: boolean;
  hint?: string;
  /** la consigne est une note interne (« NB ») : masquée pour le client */
  nb?: boolean;
  /** champ interne : jamais visible ni modifiable par le client */
  internal?: boolean;
}
export type Field = readonly [key: string, label: string, opts?: FieldOpts];
export type Check = readonly [key: string, label: string];
export interface Group {
  title?: string;
  fields?: Field[];
  checks?: Check[];
  woo?: boolean;
  /** groupe entièrement interne (absent de la page client) */
  internal?: boolean;
}
export interface Page {
  id: "client" | "existant" | "perimetre";
  title: string;
  groups: Group[];
}

export const PAGES: Page[] = [
  {
    id: "client",
    title: "Informations client",
    groups: [
      {
        fields: [
          ["livraison", "Date de livraison estimée", { cls: "key violet", internal: true }],
          ["entreprise", "Nom de l'entreprise", { cls: "key" }],
          ["offre", "Offre signée par le client", { internal: true }],
          ["dirigeants", "Dirigeant(s)"],
          ["interlocuteur", "Interlocuteur principal (nom, prénom, téléphone, e-mail)", { hint: "Téléphone et e-mail obligatoires." }],
          ["activite", "Description de l'activité", { area: true, wide: true }],
          ["services", "Service(s) et/ou Produit(s)", { area: true, wide: true }],
          ["objectifs", "Objectifs du site et clients visés", { area: true, wide: true }],
        ],
      },
      {
        title: "Coordonnées de l'entreprise à afficher sur le site internet",
        fields: [
          ["adresse", "Adresse postale de l'entreprise"],
          ["telephone", "N° téléphone de l'entreprise"],
          ["email", "E-mail de contact"],
          ["horaires", "Horaires d'ouverture"],
          ["reseaux", "Liens réseaux sociaux", { wide: true }],
        ],
      },
      { title: "Remarques", fields: [["rq_client", "Remarques", { area: true, wide: true, nolabel: true }]] },
    ],
  },
  {
    id: "existant",
    title: "Analyse de l'existant",
    groups: [
      {
        fields: [
          ["domaine_existant", "Nom de domaine existant", { cls: "red" }],
          ["site_actuel", "Lien du site actuel / CMS utilisé"],
          ["hebergeur_web", "Hébergeur web"],
          ["hebergeur_domaine", "Hébergeur nom de domaine"],
          ["hebergeur_mail", "Hébergeur e-mail"],
          ["type_mail", "Type d'hébergement e-mail (IMAP, POP, Office 365 ou Google Workspace)"],
          ["adresses_mail", "Adresses e-mail existantes", { area: true }],
          ["pages_conserver", "Pages importantes du site actuel à conserver", { area: true, hint: "Pour les redirections 301 à la mise en ligne." }],
          ["analytics", "Compte Google Analytics / Search Console pour ce site ?"],
          ["acces", "Accès clients (hébergeur, site existant…)", { internal: true, hint: "Ne pas noter les identifiants ici : indiquer seulement où ils sont stockés." }],
          ["en_ligne", "Le site actuel doit-il rester en ligne pendant la production ?", { wide: true, hint: "Dans tous les cas, nous produisons sur votrenomdedomaine.yellowtie.fr." }],
        ],
      },
      { title: "Remarques", fields: [["rq_existant", "Remarques", { area: true, wide: true, nolabel: true }]] },
    ],
  },
  {
    id: "perimetre",
    title: "Périmètre du projet",
    groups: [
      {
        fields: [
          ["domaine_choisi", "Nom de domaine sélectionné", { cls: "key red", internal: true }],
          ["maquette_lien", "Maquette Emergent (lien)", { cls: "key violet", internal: true }],
          ["maquette_validee", "Maquette validée par le client le", { cls: "key violet", internal: true, hint: "Textes et photos de la maquette provisoires ; modification du design après validation = devis." }],
          ["arborescence", "Arborescence principale", { area: true, hint: "Une page par ligne." }],
          ["footer_menu", "Menu bas de site", { area: true, hint: "Une entrée par ligne." }],
          ["references", "Sites références envoyés par le client (mini. 3)", { area: true, wide: true, hint: "Un lien par ligne, avec ce qui plaît." }],
        ],
      },
      {
        title: "Design graphique",
        fields: [
          ["charte", "Charte graphique existante ? (logo, police, couleurs)"],
          ["polices", "Polices à utiliser (Google Font par défaut)"],
          ["couleurs", "Couleurs à utiliser", { nb: true, hint: "NB : si possible, demander les codes hexadécimaux." }],
          ["photos", "Utilisation de photos / vidéos libres de droit ?"],
        ],
      },
      {
        title: "Contenus à fournir par le client",
        checks: [
          ["c_logo", "Logo (SVG ou PNG haute définition)"],
          ["c_textes", "Textes des pages"],
          ["c_photos", "Photos réelles"],
          ["c_fiches", "Fiches produits / services (tableur YellowTie)"],
          ["c_legal", "Informations légales (raison sociale, SIREN, siège)"],
        ],
        fields: [["date_contenus", "Date limite de remise des contenus", { cls: "key", internal: true }]],
      },
      {
        title: "Périmètre technique",
        fields: [
          ["repetitifs", "Contenus répétitifs (produits, services, réalisations…) : quoi, combien, quelles infos par fiche", { area: true, wide: true, nb: true, hint: "Sert à créer les champs personnalisés et le tableur de collecte envoyé au client." }],
          ["specificites", "Spécificités à mettre en place (compte utilisateur, feed Instagram, chatbot, extensions tierces)", { area: true, wide: true }],
          ["avis", "Avis clients / témoignages (synchro Google Avis ou carrousel)"],
          ["formulaires", "Formulaire de contact / devis (champs + e-mail de réception)"],
          ["mail_domaine", "Création d'un e-mail @nomdedomaine (Oui/Non)"],
          ["gmb", "Création d'un Google My Business (Oui/Non)", { nb: true, hint: "Si GMB existe déjà, demander un accès pour yellowtielyon@gmail.com." }],
          ["motscles", "Mots-clés et zone géographique visée", { area: true, wide: true }],
        ],
      },
      {
        title: "Si WooCommerce",
        woo: true,
        fields: [
          ["woo_adresse", "Adresse de la boutique"],
          ["woo_inventaire", "Inventaire des produits (sinon tableau Excel à remplir)"],
          ["woo_categories", "Catégories des produits (arborescence)"],
          ["woo_stocks", "Gestion des stocks (Oui/Non)"],
          ["woo_tva", "Gestion de la TVA (taux à ajouter)"],
          ["woo_expedition", "Frais et pays d'expédition"],
          ["woo_paiement", "Méthodes de paiement"],
          ["woo_email", "E-mail de destination des nouvelles commandes"],
        ],
      },
      { title: "Remarques chef de projet", internal: true, fields: [["rq_projet", "Remarques chef de projet", { area: true, wide: true, nolabel: true, internal: true }]] },
    ],
  },
];

export const ALL_FIELDS: Field[] = PAGES.flatMap((p) => p.groups.flatMap((g) => g.fields ?? []));
export const ALL_CHECKS: Check[] = PAGES.flatMap((p) => p.groups.flatMap((g) => g.checks ?? []));
export const FIELD_KEYS = new Set(ALL_FIELDS.map((f) => f[0]));
export const CHECK_KEYS = new Set(ALL_CHECKS.map((c) => c[0]));
/** champs que le client peut lire et modifier */
export const CLIENT_FIELD_KEYS = new Set(ALL_FIELDS.filter((f) => !f[2]?.internal).map((f) => f[0]));
export const FIELD_LABELS: Record<string, string> = Object.fromEntries(ALL_FIELDS.map((f) => [f[0], f[1]]));

export const DEFAULTS: Record<string, string> = {
  arborescence: "Accueil\nContactez-nous",
  footer_menu: "Navigation\nPages légales\nCoordonnées (téléphone, e-mail, adresse)",
};

/* Limites de validation */
export const MAX_FIELD_LEN = 10_000;
export const MAX_NAME_LEN = 200;

/** Cahier des charges tel que stocké (store « cdc »). */
export interface Cdc {
  id: string;
  name: string;
  status: StatusKey;
  woo: boolean;
  f: Record<string, string>;
  checks: Record<string, boolean>;
  /** champs / cases saisis par le client : clé → date (ms) de la dernière saisie */
  clientFilled: Record<string, number>;
  share: { tokenHash: string; createdAt: number; lastClientEditAt?: number } | null;
  createdAt: number;
  updatedAt: number;
}

/** Version envoyée à l'interface équipe : jamais le hash du jeton. */
export type CdcView = Omit<Cdc, "share"> & { share: { createdAt: number; lastClientEditAt?: number } | null };

export interface CdcSummary {
  id: string;
  name: string;
  entreprise: string;
  domaine: string;
  livraison: string;
  status: StatusKey;
  updatedAt: number;
  hasShare: boolean;
  hasClientEdits: boolean;
  pct: Record<string, number>;
}

/* Calculs communs */
export function fieldValue(c: Pick<Cdc, "f">, k: string): string {
  return String(c.f?.[k] ?? "").trim();
}

export function pagePct(c: Pick<Cdc, "f" | "woo">, p: Page): number {
  const fs = p.groups
    .filter((g) => !g.woo || c.woo)
    .flatMap((g) => g.fields ?? [])
    .filter((f) => !f[0].startsWith("rq_"));
  const done = fs.filter((f) => fieldValue(c, f[0])).length;
  return fs.length ? Math.round((done * 100) / fs.length) : 0;
}

export function summarize(c: Cdc): CdcSummary {
  return {
    id: c.id,
    name: c.name,
    entreprise: fieldValue(c, "entreprise"),
    domaine: fieldValue(c, "domaine_choisi"),
    livraison: fieldValue(c, "livraison"),
    status: c.status,
    updatedAt: c.updatedAt,
    hasShare: !!c.share,
    hasClientEdits: Object.keys(c.clientFilled ?? {}).length > 0,
    pct: Object.fromEntries(PAGES.map((p) => [p.id, pagePct(c, p)])),
  };
}

export function toView(c: Cdc): CdcView {
  const { share, ...rest } = c;
  return { ...rest, share: share ? { createdAt: share.createdAt, lastClientEditAt: share.lastClientEditAt } : null };
}
