# Santé Facile — Plan de lancement P0 → P3 (validé le 12/07/2026)

Issu de l'analyse stratégique à 5 agents (Marché, Produit, UX/UI, Monétisation, Synthèse).
Légende : ✅ fait (code livré) · 🔧 technique restant · 👤 action humaine (non délégable au code).

## P0 — Confiance & sécurité (AVANT tout pilote)

| Item | Statut | Détail |
|---|---|---|
| Fallback urgence non prise | ✅ | Chronomètre d'attente + au-delà de 4 min : panneau secours avec appels directs SAMU 185 / Pompiers 180 (`ConsultationPage`, seuil dans `config.ts`) |
| Numéros d'urgence vérifiés | ✅ / 👤 | 185/180/110 confirmés par sources publiques (Orange CI) et centralisés dans `config.ts` — confirmation officielle ministère à obtenir |
| Lien stock ↔ commande | ✅ | Badges de disponibilité par médicament (En stock / Rupture / Non référencé), avertissement avant acceptation, décrémentation du stock à la préparation (`CommandesPage`) |
| Notifications 4 moments clés | ✅ | Table `sante_notifications` + 5 triggers SQL (RDV, urgence prise, ordonnance/commande, livraison, décision assurance, messages) + cloche 🔔 temps réel dans l'en-tête (migration 009) |
| Mentions légales / CGU / Confidentialité | ✅ / 👤 | 3 pages publiques modèles avec bandeau « à valider par juriste » + liens partout (`/mentions-legales`, `/confidentialite`, `/cgu`) |
| Consentement explicite à l'inscription | ✅ | Case CGU obligatoire + horodatage stocké en base (`profiles.accepted_terms_at`) |
| Consentement vidéo + serveur configurable | ✅ / 🔧 | Écran de consentement avant chaque salle ; serveur Jitsi configurable via `VITE_JITSI_URL` — provisionner un serveur dédié/JaaS avant lancement |
| Validation juridique CI | 👤 | Engager un juriste ivoirien : PNT 2021, e-ordonnance, données de santé (loi 2013-450, ARTCI), responsabilités |
| Notifications e-mail/SMS | 🔧 | Étape suivante : Edge Function + fournisseur (Resend/SMTP, SMS local type LeTexto) — nécessite un compte fournisseur |

## P1 — Adoption

| Item | Statut | Détail |
|---|---|---|
| Lazy-loading des pages | ✅ | Bundle initial 496 → 402 kB (115 kB gzip), chaque page 1-7 kB à la demande |
| Paiement mobile money | 🔧 👤 | Wave d'abord (API Business à demander), puis Orange Money / MTN MoMo — nécessite comptes marchands |
| Canal WhatsApp | 🔧 👤 | WhatsApp Business API (Meta) à provisionner ; en attendant : liens wa.me pour partage |
| Offline léger / PWA | ✅ | Manifest + service worker réseau-d'abord (app shell hors ligne) + bannière hors-ligne dans les dashboards |
| Onboarding confiance | ✅ | Tutoriel premier usage (3 étapes, mémorisé localement) + badges « ✓ médecin vérifié » dans la réservation et la messagerie. Photos réelles des médecins : à ajouter avec les praticiens pilotes (👤) |

## P2 — Pilote réel (Abidjan périphérie / villes secondaires)

- 👤 Signer 2-3 pharmacies pilotes (via UNPPCI, argument : commandes qualifiées + visibilité garde)
- 👤 Signer 1 assureur/mutuelle pilote (NSIA, SUNU, MUGEF-CI — argument : cycle de prise en charge digitalisé prêt)
- 👤 Recruter 3-5 médecins vérifiés (Ordre des médecins)
- ✅ Script de purge prêt : `supabase/purge_donnees_test.sql` (supprime comptes @santefacile.test + pharmacies fictives, conserve schéma et paramètres)
- Indicateurs : taux d'urgences prises < 4 min, % ordonnances livrées < 24 h, NPS patient, commission moyenne/transaction

## P3 — Croissance

- 👤 B2B2C : offres employeurs/ONG (santé salariés)
- 👤 CNAM/CMU : proposer l'app comme guichet numérique (vérification droits, orientation conventionnés)
- 🔧 Multi-pays : numéros d'urgence par pays, devises, langues (préparé dans `config.ts`)
- 👤 Veille concurrentielle : Umed/ADES, Medico, DabaDoc, Eyone, mPharma

## Différenciation retenue à trancher (issue de l'analyse marché)
Trois angles possibles — choisir avant le pilote : **B2B employeurs** · **zones sous-médicalisées** · **interface CMU**.

## Ajout du 12/07/2026 — Paramètres système admin

✅ Espace **/admin/parametres** : numéros d'urgence, seuil fallback, serveur Jitsi, commission, textes légaux (CGU/confidentialité/mentions), identifiants mobile money — stockés dans `sante_settings` (migration 010, lecture publique / écriture admin RLS), appliqués immédiatement dans toute l'app avec repli sur les valeurs par défaut du code.
