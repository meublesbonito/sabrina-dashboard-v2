# Sabrina Dashboard V2

Ops Command Center for Meubles Bonito.

## Stack
- HTML/CSS/JS vanilla (modulaire)
- Vercel serverless functions (Node.js)
- Airtable + OpenAI

## Pages
- **Today** — Actions du jour
- **Clients** — Recherche + drawer
- **Health** — Santé Sabrina

## Architecture
- Auth cookie-based signé HMAC-SHA256 (24h)
- Dark mode via CSS variables
- Source unique de vérité (`buildActionQueue()`)

## Authentification

Variables d'environnement requises (configurer sur Vercel) :
- `DASHBOARD_USERS` : liste séparée par virgules
- `DASHBOARD_PASSWORD` : mot de passe partagé
- `SESSION_SECRET` : chaîne aléatoire 32+ chars

### Tester

1. Ouvrir l'URL Vercel
2. Sélectionner un utilisateur configuré
3. Saisir le mot de passe configuré
4. Accès au dashboard

## Déploiement

Push sur main → Vercel redéploie automatiquement.
