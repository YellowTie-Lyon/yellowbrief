/* Couche d'accès aux données : SEUL fichier qui connaît Netlify Blobs.
   Pour passer à Supabase, il suffit de réimplémenter ces fonctions. */
import { getStore } from "@netlify/blobs";
import type { Cdc } from "../../../shared/model.ts";

const cdcStore = () => getStore({ name: "cdc", consistency: "strong" });
const tokenStore = () => getStore({ name: "tokens", consistency: "strong" });
const rateStore = () => getStore({ name: "ratelimit", consistency: "strong" });

export async function listCdc(): Promise<Cdc[]> {
  const store = cdcStore();
  const { blobs } = await store.list();
  const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Cdc | null>));
  return items.filter((x): x is Cdc => !!x).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getCdc(id: string): Promise<Cdc | null> {
  return ((await cdcStore().get(id, { type: "json" })) as Cdc | null) ?? null;
}

export async function createCdc(cdc: Cdc): Promise<void> {
  await cdcStore().setJSON(cdc.id, cdc);
}

/** Lecture-modification-écriture avec contrôle d'ETag (nouvelle tentative en cas de conflit).
    `mutate` reçoit l'objet à jour et renvoie le nouvel objet. Renvoie null si le CDC n'existe pas. */
export async function updateCdc(id: string, mutate: (c: Cdc) => Cdc): Promise<Cdc | null> {
  const store = cdcStore();
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await store.getWithMetadata(id, { type: "json" });
    if (!cur) return null;
    const next = mutate(cur.data as Cdc);
    const res = await store.setJSON(id, next, cur.etag ? { onlyIfMatch: cur.etag } : undefined);
    if (res.modified) return next;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 70));
  }
  throw new Error("Conflit d'écriture persistant");
}

export async function deleteCdc(id: string): Promise<void> {
  await cdcStore().delete(id);
}

/* Jetons client : clé = sha256(jeton), valeur = id du CDC */
export async function setTokenOwner(tokenHash: string, id: string): Promise<void> {
  await tokenStore().set(tokenHash, id);
}
export async function findIdByTokenHash(tokenHash: string): Promise<string | null> {
  return (await tokenStore().get(tokenHash, { type: "text" })) ?? null;
}
export async function deleteToken(tokenHash: string): Promise<void> {
  await tokenStore().delete(tokenHash);
}

/* Limitation des tentatives de connexion */
export interface RateState { count: number; first: number }
export async function getRate(key: string): Promise<RateState | null> {
  return ((await rateStore().get(key, { type: "json" })) as RateState | null) ?? null;
}
export async function setRate(key: string, s: RateState): Promise<void> {
  await rateStore().setJSON(key, s);
}
export async function clearRate(key: string): Promise<void> {
  await rateStore().delete(key);
}
