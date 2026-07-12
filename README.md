# Santé Facile (sante-facile-ci)

> Le médecin et la pharmacie viennent à vous — plus jamais de salle d'attente.

Écosystème complet de télémédecine + pharmacie + assurance pour la Côte d'Ivoire (Abidjan en priorité, extension prévue Afrique de l'Ouest).

## État d'avancement

- ✅ **Module 1** — Authentification multi-rôles (patient / médecin / pharmacie / assureur / admin, RLS)
- ✅ **Module 2** — Profil patient + géolocalisation + pharmacie la plus proche (Haversine)
- ✅ **Module 3** — Réservation & urgence (file de priorité temps réel)
- ✅ **Module 4** — Vidéoconsultation (Jitsi Meet embed)
- ✅ **Module 5** — Prescription électronique (envoi auto à la pharmacie, impression PDF)
- ✅ **Module 6** — Tableau de bord Pharmacie (commandes + stock basique)
- ✅ **Module 7** — Suivi de livraison temps réel (`sante_deliveries` + Realtime)
- ✅ **Module 8** — Tableau de bord Assureur (éligibilité, prises en charge, remboursements)
- ✅ **Module 9** — Chat sécurisé & documents médicaux (Storage + RLS)
- ✅ **Module 10** — Chatbot d'assistance (réponses pré-définies, FR)
- ✅ **Module 11** — Documentation : voir **[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)**

## Démarrage rapide

1. Créez un projet gratuit sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez les 8 scripts de `supabase/migrations/` **dans l'ordre** (001 → 008).
3. (Tests) Désactivez **Authentication > Sign In / Up > Email > Confirm email** et décommentez les pharmacies fictives du script 002.
4. `cp .env.example .env` puis renseignez `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
5. `npm install && npm run dev` → http://localhost:5173

Le guide complet (schéma BDD, RPC, sécurité, déploiement Vercel, recette E2E, points juridiques à valider) est dans [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).

## Stack

React 18 + TypeScript (Vite) · TailwindCSS · Supabase (PostgreSQL, Auth, Storage, Realtime) · Jitsi Meet · Vercel

## Notes importantes

- Les partenariats réels (pharmacies, assureurs) doivent être négociés séparément — l'architecture est conçue pour les « brancher » facilement.
- Les contraintes réglementaires ivoiriennes (télémédecine, e-ordonnance, données de santé) sont **à faire valider par un juriste local**.
