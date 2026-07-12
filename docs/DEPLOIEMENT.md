# Santé Facile — Documentation technique & déploiement (Module 11)

> Plateforme de télémédecine + pharmacie + assurance — Côte d'Ivoire (Abidjan), extension prévue Afrique de l'Ouest.
> Stack : React 18 + TypeScript (Vite) + TailwindCSS · Supabase (PostgreSQL, Auth, Storage, Realtime) · Jitsi Meet · Vercel.

---

## 1. Schéma de base de données

Exécuter les migrations **dans l'ordre**, dans Supabase → SQL Editor :

| # | Fichier | Contenu |
|---|---------|---------|
| 1 | `supabase/migrations/001_auth_multi_roles.sql` | Enum `user_role` (5 rôles), table `profiles`, trigger de création auto, anti-escalade, RLS |
| 2 | `supabase/migrations/002_geolocalisation_pharmacies.sql` | `pharmacies`, `patient_profiles`, RPC `nearest_pharmacies` (Haversine), RLS |
| 3 | `supabase/migrations/003_reservation_urgence.sql` | `medecin_profiles`, `appointments` (+ urgences, salle Jitsi), RPC `list_verified_doctors`, Realtime |
| 4 | `supabase/migrations/004_prescriptions.sql` | `prescriptions`, `prescription_items`, RPC `select_pharmacy_for_patient`, RLS |
| 5 | `supabase/migrations/005_stock_pharmacie.sql` | `stock_items` (stock privé par officine), RLS |
| 6 | `supabase/migrations/006_livraisons.sql` | `sante_deliveries` (préparation → en route → livré), Realtime |
| 7 | `supabase/migrations/007_assurance.sql` | `insurance_policies`, `coverage_requests`, RPC `find_patient_by_email`, RLS |
| 8 | `supabase/migrations/008_chat_documents.sql` | `conversations`, `messages` (Realtime), bucket privé `medical-documents` + policies Storage |
| 9 | `supabase/migrations/009_p0_confiance_notifications.sql` | P0 : `sante_notifications` + 5 triggers de notification (Realtime), consentement CGU horodaté (`profiles.accepted_terms_at`) |
| 10 | `supabase/migrations/010_parametres_systeme.sql` | `sante_settings` (clé/valeur JSONB) : numéros d'urgence, seuil fallback, Jitsi, commission, textes légaux, mobile money — lecture publique, écriture admin (RLS), éditable via /admin/parametres |

### Tables (résumé)

- **profiles** — 1 ligne par compte ; `role` (patient/medecin/pharmacie/assureur/admin), `is_verified` (professionnels validés par admin).
- **patient_profiles** — adresse, commune, ville, `lat`/`lng`, `preferred_pharmacy_id`.
- **medecin_profiles** — spécialité, `is_available_now` (urgences).
- **pharmacies** — fiche officine (nom, adresse, GPS, téléphone, `is_active`) ; `owner_profile_id` nullable = partenaire pré-enregistré « branchable ».
- **appointments** — RDV & urgences ; urgence = `is_emergency` + `medecin_id NULL` (file de priorité) ; `room_code` = salle Jitsi.
- **prescriptions** + **prescription_items** — e-ordonnances ; pharmacie auto-sélectionnée (préférée → sinon plus proche).
- **stock_items** — stock basique privé par officine.
- **sante_deliveries** — 1 livraison par ordonnance, statuts horodatés, **Realtime**.
- **insurance_policies** — éligibilité (assureur ↔ patient), % de couverture, validité.
- **coverage_requests** — 1 demande par ordonnance, décision totale/partielle/refus, montant, historique = remboursements.
- **conversations** + **messages** — messagerie patient ↔ médecin, **Realtime**, pièces jointes via Storage.

### Fonctions SQL (endpoints RPC)

| Fonction | Accès | Rôle |
|---|---|---|
| `get_my_role()` | interne policies | rôle de l'utilisateur courant (anti-récursion RLS) |
| `nearest_pharmacies(p_lat, p_lng, p_limit)` | authentifié | pharmacies actives + vérifiées triées par distance (Haversine, km) |
| `list_verified_doctors()` | authentifié | médecins vérifiés (nom, spécialité, dispo) |
| `select_pharmacy_for_patient(p_patient)` | médecin/admin | pharmacie préférée du patient, sinon la plus proche |
| `find_patient_by_email(p_email)` | assureur vérifié/admin | id + nom du patient (vérification d'éligibilité) |

### Sécurité (principes)

- **RLS activée sur toutes les tables** — chaque rôle ne voit que ce qui le concerne ; l'admin voit tout.
- Rôle `admin` **impossible à choisir à l'inscription** (trigger) ; promotion uniquement en SQL (§8 du script 001).
- **Anti-escalade** : `role`, `is_verified`, `email` modifiables uniquement par un admin (trigger).
- Professionnels **non vérifiés** : invisibles des patients (médecins, pharmacies) et bloqués pour émettre (ordonnances, polices).
- Documents médicaux : bucket **privé**, chemin `{uid}/…`, lecture limitée aux participants de la conversation, URLs signées 1 h.
- ⚠️ Limite MVP connue : les transitions de statut (RDV, ordonnances) sont contrôlées par l'UI et les policies larges `update` — un contrôle fin par machine à états (triggers) est recommandé avant production.

---

## 2. Variables d'environnement (`.env`)

```bash
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co   # Project Settings > API
VITE_SUPABASE_ANON_KEY=VOTRE_CLE_ANON_PUBLIQUE       # clé "anon public" UNIQUEMENT
# Optionnel : serveur Jitsi dédié (défaut meet.jit.si — prototype uniquement)
# VITE_JITSI_URL=https://jitsi.votre-domaine.ci
```

⚠️ Ne jamais mettre la clé `service_role` côté frontend.

---

## 3. Configuration Supabase (une fois)

1. Créer le projet sur supabase.com (région Europe de l'Ouest conseillée pour la latence Abidjan).
2. Exécuter les 8 migrations dans l'ordre (SQL Editor).
3. **Authentication → Sign In / Up → Email** : désactiver *Confirm email* pour les tests (le flux avec confirmation est aussi géré par l'app).
4. Créer le premier **admin** : s'inscrire via l'app puis exécuter l'`update` du §8 du script 001.
5. (Tests) Décommenter le bloc « pharmacies fictives » du script 002.
6. Vérifier que Realtime est actif (Database → Publications → `supabase_realtime` contient `appointments`, `sante_deliveries`, `messages`).

---

## 4. Lancement local

```bash
npm install
cp .env.example .env   # puis renseigner les 2 variables
npm run dev            # http://localhost:5173
npm run build          # vérification TypeScript + build production
```

---

## 5. Déploiement Vercel

1. Pousser le dépôt sur GitHub.
2. Vercel → New Project → importer le dépôt (framework **Vite** détecté automatiquement).
3. Ajouter les 2 variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Déployer — `vercel.json` gère déjà le routage SPA (rewrites → index.html).
5. Supabase → Authentication → URL Configuration : ajouter l'URL Vercel dans *Site URL* / *Redirect URLs*.

---

## 6. Parcours de test de bout en bout (recette)

1. **Admin** : s'inscrire → promotion SQL → vérifier les comptes professionnels dans `/admin`.
2. **Patient** : s'inscrire → profil + GPS (`/patient/profil`) → choisir pharmacie préférée.
3. **Médecin** : s'inscrire → être vérifié par l'admin → agenda + disponibilité (`/medecin/agenda`).
4. **RDV** : patient réserve → médecin confirme → consultation vidéo Jitsi (`/consultation/:id`).
5. **Urgence** : patient clique 🚨 → le médecin voit la file d'urgence → « Prendre en charge » → salle vidéo ouverte en direct chez le patient (Realtime).
6. **e-Prescription** : médecin termine → prescrit → pharmacie auto-sélectionnée.
7. **Pharmacie** : compte pharmacie vérifié + fiche GPS → reçoit la commande → prépare → envoie en livraison (nom/tél livreur) → livre.
8. **Patient** : suit la livraison EN DIRECT (`/patient/livraisons`, badge « Temps réel actif »).
9. **Assureur** : vérifié par admin → recherche le patient par e-mail → crée la police → le patient demande la prise en charge sur son ordonnance → l'assureur approuve (totale/partielle) → historique des remboursements.
10. **Messagerie** : patient ↔ médecin, envoi d'un document (PDF/image) → ouverture via URL signée.
11. **Chatbot** : bouton 🤖 en bas à droite de chaque tableau de bord.

---

## 7. Points de vigilance avant production (transparence)

- **Réglementaire 🇨🇮** : Plan National de Télémédecine (2021), validité juridique de l'e-ordonnance, signature électronique, hébergement des données de santé, consentement, secret médical, inscription des praticiens à l'Ordre — **tous ces points sont à faire valider par un juriste local**. Rien dans ce code ne constitue un avis juridique.
- **Jitsi** : meet.jit.si (public, gratuit) convient au prototype ; pour la production, prévoir un serveur Jitsi dédié ou JaaS (confidentialité).
- **Partenariats** : aucune pharmacie/assurance réelle n'est incluse — les fiches partenaires sont « branchables » (`owner_profile_id`).
- **Paiement mobile** (Orange Money, MTN MoMo, Wave) : non inclus, prévu dans une itération future.
- **Numéros d'urgence** cités dans le chatbot (SAMU 185) : à vérifier localement.
- **Modèle de revenu** : commission par transaction validée (exemple 2% dans `src/lib/config.ts`) ou abonnement partenaire — à décider, la facturation n'est pas implémentée.
