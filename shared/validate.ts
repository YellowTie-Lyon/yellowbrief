/* Validation et nettoyage des entrées (côté fonctions). Rejette tout ce qui est inconnu. */
import {
  CHECK_KEYS, CLIENT_FIELD_KEYS, FIELD_KEYS, MAX_FIELD_LEN, MAX_NAME_LEN, isStatus, type StatusKey,
} from "./model.ts";

export class ValidationError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Supprime les caractères de contrôle (hors retours à la ligne et tabulation). */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n");

export interface CdcPatch {
  name?: string;
  status?: StatusKey;
  woo?: boolean;
  f?: Record<string, string>;
  checks?: Record<string, boolean>;
}

/** @param clientOnly si vrai, seuls les champs visibles côté client sont acceptés. */
export function parsePatch(body: unknown, clientOnly = false): CdcPatch {
  if (!isObj(body)) throw new ValidationError("Corps de requête invalide");
  const out: CdcPatch = {};
  if (body.name !== undefined) {
    if (clientOnly) throw new ValidationError("Champ non autorisé : name");
    if (typeof body.name !== "string") throw new ValidationError("name invalide");
    out.name = clean(body.name).trim().slice(0, MAX_NAME_LEN) || "Nouveau client";
  }
  if (body.status !== undefined) {
    if (clientOnly) throw new ValidationError("Champ non autorisé : status");
    if (!isStatus(body.status)) throw new ValidationError("Statut invalide");
    out.status = body.status;
  }
  if (body.woo !== undefined) {
    if (clientOnly) throw new ValidationError("Champ non autorisé : woo");
    if (typeof body.woo !== "boolean") throw new ValidationError("woo invalide");
    out.woo = body.woo;
  }
  if (body.f !== undefined) {
    if (!isObj(body.f)) throw new ValidationError("f invalide");
    const allowed = clientOnly ? CLIENT_FIELD_KEYS : FIELD_KEYS;
    out.f = {};
    for (const [k, v] of Object.entries(body.f)) {
      if (!allowed.has(k)) throw new ValidationError(`Champ inconnu ou non autorisé : ${k.slice(0, 40)}`);
      if (typeof v !== "string") throw new ValidationError(`Valeur invalide pour ${k}`);
      if (v.length > MAX_FIELD_LEN) throw new ValidationError(`Valeur trop longue pour ${k} (max ${MAX_FIELD_LEN} caractères)`);
      out.f[k] = clean(v);
    }
  }
  if (body.checks !== undefined) {
    if (!isObj(body.checks)) throw new ValidationError("checks invalide");
    out.checks = {};
    for (const [k, v] of Object.entries(body.checks)) {
      if (!CHECK_KEYS.has(k)) throw new ValidationError(`Case inconnue : ${k.slice(0, 40)}`);
      if (typeof v !== "boolean") throw new ValidationError(`Valeur invalide pour ${k}`);
      out.checks[k] = v;
    }
  }
  return out;
}

export function parseCreate(body: unknown): CdcPatch {
  return body === undefined || body === null ? {} : parsePatch(body);
}

/** Jeton client : 43 caractères base64url (32 octets). */
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
/** Id de CDC : UUID v4. */
export const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
