/* Variables d'environnement : aucune valeur par défaut pour les secrets. */
export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new ConfigError(`Variable d'environnement manquante : ${name}`);
  return v;
}
export class ConfigError extends Error {}
