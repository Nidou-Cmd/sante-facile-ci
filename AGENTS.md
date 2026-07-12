# AGENTS.md — Guide pour agents IA / lecteurs automatisés

> Ce fichier suit la convention [agents.md](https://agentsmd.net/) : il donne à un agent IA
> (ou à un développeur) tout le contexte nécessaire pour comprendre, exécuter et étendre ce
> dépôt **sans avoir à lire tous les fichiers**. Écrit en français (langue du projet).

## 1. En une phrase

**Santé Facile** est une plateforme web de **télémédecine + e-prescription + livraison de
médicaments par pharmacies partenaires + prise en charge assurance**, pensée pour la
**Côte d'Ivoire** (Abidjan d'abord), puis l'Afrique de l'Ouest. Slogan : « Le médecin et la
pharmacie viennent à vous — plus jamais de salle d'attente ».

## 2. Stack technique

| Couche | Choix |
|---|---|
| Frontend | React 18 + TypeScript, **Vite**, TailwindCSS, React Router 6 |
| Backend / BDD | **Supabase** (PostgreSQL, Auth, Row Level Security, Realtime, Storage) |
| Vidéo | Jitsi Meet (iframe, serveur configurable) |
| Déploiement cible | Vercel (frontend) + Supabase (backend) |
| Tests | Harnais E2E Python (`e2e/`) via l'API REST/Auth avec la clé anon |

Aucune dépendance lourde ajoutée : distance = SQL (Haversine), temps réel = Supabase Realtime,
paiement/notifications = à brancher (voir feuille de route).

## 3. Démarrage rapide

```bash
npm install
cp .env.example .env          # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
# Dans Supabase > SQL Editor : exécuter supabase/migrations/001 → 010 DANS L'ORDRE
npm run dev                   # http://localhost:5173
npm run build                 # tsc (strict) + vite build — doit passer sans erreur
```

Détails complets (config Supabase, Realtime, Vercel, recette de test) : **`docs/DEPLOIEMENT.md`**.

## 4. Modèle de données (schéma Supabase)

13 tables applicatives, toutes protégées par **RLS**. Migrations dans `supabase/migrations/` :

| # | Fichier | Apporte |
|---|---|---|
| 001 | auth_multi_roles | enum `user_role` (patient/medecin/pharmacie/assureur/admin), `profiles`, trigger de création de profil, anti-escalade de privilèges |
| 002 | geolocalisation_pharmacies | `pharmacies`, `patient_profiles`, RPC `nearest_pharmacies` (Haversine) |
| 003 | reservation_urgence | `medecin_profiles`, `appointments` (+ urgences), RPC `list_verified_doctors`, Realtime |
| 004 | prescriptions | `prescriptions`, `prescription_items`, RPC `select_pharmacy_for_patient` |
| 005 | stock_pharmacie | `stock_items` (stock privé par officine) |
| 006 | livraisons | `sante_deliveries` (préparation → en_route → livré), Realtime |
| 007 | assurance | `insurance_policies`, `coverage_requests`, RPC `find_patient_by_email` |
| 008 | chat_documents | `conversations`, `messages` (Realtime), bucket privé `medical-documents` |
| 009 | p0_confiance_notifications | `sante_notifications` + 5 triggers, consentement CGU horodaté |
| 010 | parametres_systeme | `sante_settings` (clé/valeur JSONB) éditable par l'admin |

Les types TypeScript miroir sont dans `src/lib/database.types.ts`.

## 5. Modèle de sécurité (à respecter impérativement)

- **RLS activée partout** : chaque rôle ne voit que ses données ; l'admin voit tout via `get_my_role()`.
- Le rôle `admin` **ne peut pas** être choisi à l'inscription (trigger `handle_new_user`). Promotion via SQL uniquement.
- **Anti-escalade** : `role`, `is_verified`, `email` ne sont modifiables que par un admin (trigger `protect_profile_fields`).
- Professionnels (médecin/pharmacie/assureur) créés **non vérifiés** → invisibles/bloqués tant qu'un admin ne les valide pas.
- Documents médicaux : bucket **privé**, chemin `{uid}/…`, URLs signées à durée limitée.
- Fonctions sensibles en `SECURITY DEFINER` avec contrôle de rôle interne.
- ⚠️ Ne JAMAIS stocker de secret dans `sante_settings` (lecture publique) ni committer la clé `service_role`.

## 6. Cartographie du code (`src/`)

- `contexts/AuthContext.tsx` — session Supabase + profil + rôle (source de vérité de l'auth).
- `lib/settings.tsx` — paramètres système dynamiques (`useSettings()`), repli sur `lib/config.ts`.
- `lib/supabaseClient.ts` — client typé. `lib/database.types.ts` — types BDD.
- `components/ProtectedRoute.tsx` — garde de route par rôle. `DashboardLayout.tsx` — coquille commune (cloche notifs, footer légal, bannière hors-ligne).
- `pages/patient|medecin|pharmacie|assureur|admin/` — écrans par rôle. `pages/legal/` — CGU/confidentialité/mentions (contenu administrable).
- `pages/ConsultationPage.tsx` — vidéo Jitsi + fallback urgence. `pages/MessagesPage.tsx` — chat + documents.
- `App.tsx` — routeur (lazy-loading), `SettingsProvider` + `AuthProvider`.

## 7. Parcours métier de bout en bout

Patient s'inscrit → renseigne adresse/GPS → réserve un RDV (ou 🚨 urgence prioritaire) →
téléconsultation vidéo → le médecin émet une e-ordonnance **routée automatiquement** vers la
pharmacie préférée/la plus proche → la pharmacie prépare (contrôle de stock) et déclenche la
livraison **suivie en temps réel** → l'assureur valide la prise en charge (totale/partielle) →
notifications in-app à chaque étape.

## 8. Tests

Harnais Python dans `e2e/` (exécuté avec `SF_URL` + `SF_ANON` en variables d'environnement) :
`phase1.py` (modules 1-4,9 + sécurité), `phase2.py` (admin, RDV, prescription, livraison, assurance),
`phase3.py` (consentement + notifications), `phase4.py` (paramètres système). Résultat de référence :
**62/62** vérifications sur les phases 1-2 + module 10 + storage + realtime lors du dernier run réel.

## 9. Feuille de route & état

Voir **`docs/PLAN-LANCEMENT.md`** (plan P0→P3). Résumé : P0 confiance/sécurité ✅ codé, P1 adoption
(lazy-loading, PWA offline, onboarding) ✅ codé — **paiement mobile money (Wave/Orange Money/MTN) et
WhatsApp = à brancher** (comptes marchands requis). Actions non techniques (juriste ivoirien,
partenariats pharmacies/assureurs, confirmation officielle des numéros d'urgence) marquées 👤.

## 10. Contexte réglementaire (transparence — NE PAS présenter comme acquis)

La Côte d'Ivoire a un Plan National de Télémédecine (2021). **Toutes** les mentions réglementaires
(validité de l'e-ordonnance, hébergement des données de santé, loi 2013-450/ARTCI, secret médical,
numéros d'urgence SAMU 185 / Pompiers 180 / Police 110) sont **à faire valider par un juriste local**.
Les pharmacies et assureurs présents dans les données de test sont **fictifs** ; aucun partenariat réel
n'est signé. Rien dans ce dépôt ne constitue un avis juridique ni médical.

## 11. Conventions pour contribuer (humain ou IA)

- Toute nouvelle table → RLS activée + policies par rôle + type ajouté dans `database.types.ts`.
- Toute valeur opérationnelle (numéro, seuil, texte légal, taux) → passer par `sante_settings`, pas de dur.
- `npm run build` doit rester vert (TypeScript strict, `noUnusedLocals`).
- UI et messages utilisateur en **français**.
