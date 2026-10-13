# YellowBrief

Application interne de l'agence web **YellowTie** (Lyon) pour rédiger, regrouper et exporter les cahiers des charges des sites internet.
Hébergement : Netlify, sur `yellowbrief.yellowtie.fr`.

- Espace équipe protégé par mot de passe : liste, recherche, filtres par statut, édition avec sauvegarde automatique.
- Lien client révocable : le client remplit une version simplifiée, ses réponses sont marquées côté équipe.
- Exports : brief Emergent, Markdown pour Claude, Word `.docx` (mise en page OneNote).
- API JSON/Markdown protégée par jeton, pour Claude / un futur connecteur MCP.

## Stack

Vite + TypeScript (front sans framework) · Netlify Functions (TypeScript) · Netlify Blobs · librairie `docx`.

```
shared/                   modèle (PAGES, statuts), exports texte, validation : partagés front + fonctions
src/                      front (index.html = équipe, client.html = page client)
netlify/functions/        auth, cdc-app (équipe), cdc-client (lien client), cdc-api (Bearer)
netlify/functions/_lib/   storage.ts (seule couche qui touche Netlify Blobs), session, limitation, docx…
tests/                    tests unitaires (npm test)
prototype.html            prototype d'origine, conservé comme référence
```

## Variables d'environnement

Aucun secret dans le code. Voir `.env.example`.

| Variable | Rôle | Génération |
|---|---|---|
| `TEAM_PASSWORD` | Mot de passe d'équipe de l'espace protégé | au choix, long |
| `SESSION_SECRET` | Signature HMAC des cookies de session | `openssl rand -base64 48` |
| `API_TOKEN` | Jeton Bearer de l'API `/api/cdc` | `openssl rand -base64 32` |

Dans Netlify : *Site configuration → Environment variables* (cocher « Contains secret values » pour les trois). Changer `SESSION_SECRET` déconnecte tout le monde.

## Installation locale

```bash
npm install
cp .env.example .env      # puis remplir les 3 variables
npx netlify dev           # http://localhost:8888
```

- `netlify dev` lance `vite build --watch` et sert `dist/` : la CSP stricte de production s'applique aussi en local (recharger la page après une modification du front).
- Netlify Blobs fonctionne en local sans compte (stockage dans `.netlify/`, ignoré par git).
- La CLI télécharge Deno (pour les edge functions, non utilisées ici) : dans un environnement au réseau restreint, installer `deno` (`npm i -g deno`) avant de lancer `netlify dev`.
- `npm test` : tests unitaires · `npm run typecheck` · `npm run build`.

## Déploiement

**Par GitHub (recommandé)** : Netlify → *Add new site → Import from Git* → choisir le dépôt. Les réglages viennent de `netlify.toml` (build `npm run build`, publication `dist`, fonctions `netlify/functions`). Créer les 3 variables avant le premier déploiement, puis déployer.

**Par la CLI** :
```bash
npx netlify login
npx netlify init            # ou : npx netlify link
npx netlify env:set TEAM_PASSWORD '…' --secret   # idem SESSION_SECRET, API_TOKEN
npx netlify deploy --build --prod
```

### Sous-domaine yellowbrief.yellowtie.fr

1. Netlify → *Domain management → Add a domain* → `yellowbrief.yellowtie.fr`.
2. Chez le gestionnaire DNS de `yellowtie.fr`, ajouter un enregistrement **CNAME** : `yellowbrief` → `<nom-du-site>.netlify.app` (ou le « Netlify DNS » si la zone y est déléguée).
3. Attendre la propagation, puis *HTTPS → Verify DNS configuration → Provision certificate* (Let's Encrypt). Activer « Force HTTPS ».

## Générer un lien client

1. Ouvrir le cahier des charges dans l'espace équipe.
2. Cliquer **« Générer un lien client »** (bandeau sous le titre), puis **« Copier le lien »** : `https://yellowbrief.yellowtie.fr/c/<jeton>`.
3. Envoyer le lien au client. Il voit une version simplifiée, sans champs internes (remarques chef de projet, accès, maquette, statut, consignes NB…), et ses réponses sont enregistrées automatiquement.
4. Les champs remplis par le client sont marqués **« Rempli par le client »** (badge vert) côté équipe ; le marquage disparaît quand l'équipe modifie le champ.

Le jeton n'est affiché **qu'une seule fois** (seul son hash SHA-256 est stocké). Si le lien est perdu : « Générer un nouveau lien » (l'ancien est alors invalidé). **« Révoquer le lien »** coupe l'accès immédiatement.

## API pour Claude

Protégée par `Authorization: Bearer <API_TOKEN>` (le cookie d'équipe n'ouvre pas cette API).

```bash
curl -H "Authorization: Bearer $API_TOKEN" https://yellowbrief.yellowtie.fr/api/cdc                      # liste (JSON)
curl -H "Authorization: Bearer $API_TOKEN" https://yellowbrief.yellowtie.fr/api/cdc/<id>                 # un CDC (JSON)
curl -H "Authorization: Bearer $API_TOKEN" "https://yellowbrief.yellowtie.fr/api/cdc/<id>?format=md"     # Markdown
curl -H "Authorization: Bearer $API_TOKEN" "https://yellowbrief.yellowtie.fr/api/cdc/<id>?format=brief"  # brief Emergent
```

## Sécurité et RGPD

- Session : cookie `HttpOnly; Secure; SameSite=Lax` signé HMAC-SHA256, 30 jours. Connexion limitée à 5 échecs / 15 min / IP.
- Aucune route de liste sans session ; les écritures exigent `Content-Type: application/json` et une origine identique.
- Entrées validées côté fonction (champs connus uniquement, 10 000 caractères max, caractères de contrôle retirés). Le client ne peut écrire que les champs non internes.
- En-têtes dans `netlify.toml` : CSP stricte (aucun script ni style inline), `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy: no-referrer`.
- Polices hébergées en local (aucun appel à Google Fonts : l'IP des clients n'est pas transmise).
- La page client affiche une mention d'information RGPD ; le champ « Accès clients » précise seulement où les accès sont stockés (pas d'identifiants).
- Pages client et espace équipe en `noindex`.

## Passer à Supabase plus tard

Seul `netlify/functions/_lib/storage.ts` accède aux données (CDC, jetons, compteurs de connexion). Réimplémenter ses fonctions suffit.

## Limites connues

- Netlify Blobs n'a pas de transactions : les sauvegardes lisent-fusionnent-écrivent avec contrôle d'ETag (5 tentatives). Deux personnes éditant **le même champ** au même instant : la dernière écriture gagne.
- La liste des CDC est lue en entier à chaque appel (adapté à quelques centaines de cahiers des charges).
