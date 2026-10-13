/* Limitation des tentatives de connexion : MAX échecs par fenêtre et par IP. */
import { clearRate, getRate, setRate } from "./storage.ts";
import { sha256 } from "./crypto.ts";

const MAX = 5;
const WINDOW_MS = 15 * 60 * 1000;
const key = (ip: string) => "login-" + sha256(ip).slice(0, 32);

/** Renvoie le nombre de secondes à attendre, ou 0 si l'IP peut tenter. */
export async function lockedFor(ip: string): Promise<number> {
  const s = await getRate(key(ip));
  if (!s) return 0;
  const left = s.first + WINDOW_MS - Date.now();
  if (left <= 0) { await clearRate(key(ip)); return 0; }
  return s.count >= MAX ? Math.ceil(left / 1000) : 0;
}
export async function recordFailure(ip: string): Promise<void> {
  const s = await getRate(key(ip));
  if (!s || s.first + WINDOW_MS < Date.now()) await setRate(key(ip), { count: 1, first: Date.now() });
  else await setRate(key(ip), { count: s.count + 1, first: s.first });
}
export const recordSuccess = (ip: string) => clearRate(key(ip));
