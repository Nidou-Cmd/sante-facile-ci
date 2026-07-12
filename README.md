# 🏥 Santé Facile CI

> Plateforme de télémédecine pour la Côte d'Ivoire — **projet indépendant de 2S Construction**

## Description

Application web complète de télémédecine connectant patients, médecins, pharmacies et assureurs.

## Modules (11)

| Module | Fonctionnalité |
|--------|----------------|
| 1 | Auth multi-rôles (patient, médecin, pharmacie, assureur, admin) |
| 2 | Profil patient + géolocalisation + pharmacie la plus proche |
| 3 | Réservation de rendez-vous + file d'urgence |
| 4 | Consultation vidéo (Jitsi) |
| 5 | E-prescription |
| 6 | Commandes pharmacie |
| 7 | Livraison temps réel |
| 8 | Assurance & prise en charge |
| 9 | Documents & Storage |
| 10 | Chatbot FR |
| 11 | Dashboard admin |

## Stack technique

- **Frontend** : React + TypeScript + Vite + Tailwind CSS
- **Backend** : Supabase (Auth, PostgreSQL, RLS, Storage, Realtime)
- **Tests** : 62/62 E2E réussis
- **Supabase Project** : `kdtaihmvlnrepqapwdoj` (séparé de 2S Construction)

## Lancer le projet

```bash
npm install
npm run dev
# → http://localhost:5173
```

## Comptes de test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Patient | patient1@santefacile.test | SanteFacile2026! |
| Médecin | medecin1@santefacile.test | SanteFacile2026! |
| Pharmacie | pharmacie1@santefacile.test | SanteFacile2026! |
| Assureur | assureur1@santefacile.test | SanteFacile2026! |
| Admin | admin@santefacile.test | SanteFacile2026! |

---

> ⚠️ Ce projet est **distinct** du repo [2s-construction](https://github.com/Nidou-Cmd/2s-construction) qui contient les outils métier de 2S Construction.
