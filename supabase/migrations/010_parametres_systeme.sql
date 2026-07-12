-- ============================================================
-- SANTÉ FACILE — Paramètres système modifiables par l'admin
-- Fichier : supabase/migrations/010_parametres_systeme.sql
-- Prérequis : scripts 001 à 009 déjà exécutés
--
-- Objectif : sortir du code les valeurs opérationnelles (numéros
-- d'urgence, seuil de fallback, serveur Jitsi, commission, textes
-- légaux, identifiants mobile money) → table clé/valeur JSONB,
-- lisible par tous (valeurs publiques d'affichage), modifiable
-- UNIQUEMENT par un admin, via /admin/parametres.
-- ============================================================

create table public.sante_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.sante_settings is
  'Paramètres système éditables par l''admin (lecture publique : valeurs d''affichage non sensibles — ne JAMAIS y stocker de clé secrète).';

create trigger sante_settings_updated_at
  before update on public.sante_settings
  for each row execute function public.set_updated_at();

alter table public.sante_settings enable row level security;

-- Lecture : publique (les pages légales et numéros d'urgence sont
-- affichés avant connexion). ⚠️ Ne jamais stocker de secret ici.
create policy "settings_select_all"
  on public.sante_settings for select
  using (true);

-- Écriture : admin uniquement
create policy "settings_insert_admin"
  on public.sante_settings for insert to authenticated
  with check (public.get_my_role() = 'admin');

create policy "settings_update_admin"
  on public.sante_settings for update to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy "settings_delete_admin"
  on public.sante_settings for delete to authenticated
  using (public.get_my_role() = 'admin');

-- ------------------------------------------------------------
-- Valeurs initiales (reprennent les défauts actuels du code)
-- ------------------------------------------------------------
insert into public.sante_settings (key, value) values
  ('emergency_numbers', '{"samu": "185", "pompiers": "180", "police": "110"}'::jsonb),
  ('emergency_fallback_seconds', '240'::jsonb),
  ('jitsi_base_url', '"https://meet.jit.si"'::jsonb),
  ('commission_percent', '2'::jsonb),
  ('mobile_money', '{
    "wave_enabled": false, "wave_merchant_id": "", "wave_payment_link": "",
    "om_enabled": false, "om_merchant_id": "", "om_payment_link": "",
    "mtn_enabled": false, "mtn_merchant_id": "", "mtn_payment_link": ""
  }'::jsonb),
  ('legal_mentions', to_jsonb('ÉDITEUR DE LA PLATEFORME
Santé Facile (sante-facile-ci) — [À COMPLÉTER : raison sociale, forme juridique, capital, RCCM, siège social à Abidjan, téléphone, e-mail de contact].

DIRECTEUR DE LA PUBLICATION
[À COMPLÉTER : nom du représentant légal].

HÉBERGEMENT
Application hébergée par Vercel Inc. (frontend) et Supabase Inc. (données, région Europe — Francfort). [À VALIDER : conformité de l''hébergement des données de santé ivoiriennes hors du territoire national.]

ACTIVITÉ
Plateforme de mise en relation pour la télémédecine, la transmission d''ordonnances électroniques aux pharmacies partenaires et la prise en charge par des organismes d''assurance. Santé Facile n''est ni un établissement de santé, ni une pharmacie, ni un assureur. Les actes médicaux relèvent exclusivement des professionnels de santé inscrits à l''Ordre. [À VALIDER : statut exact au regard du Plan National de Télémédecine et des textes applicables en Côte d''Ivoire.]

URGENCES
En cas d''urgence vitale, appelez immédiatement le SAMU (185), les sapeurs-pompiers (180) ou la police secours (110) — numéros courts gratuits en Côte d''Ivoire.'::text)),
  ('legal_confidentialite', to_jsonb('DONNÉES COLLECTÉES
Compte (nom, e-mail, téléphone, rôle), profil médical déclaratif, adresse et position GPS (pour la recherche de pharmacies proches), rendez-vous, ordonnances, livraisons, échanges de messagerie et documents médicaux téléversés.

FINALITÉS
Mise en relation patient-médecin, transmission des ordonnances aux pharmacies, suivi des livraisons, gestion des prises en charge d''assurance, sécurité de la plateforme. Aucune vente de données. Aucune publicité ciblée.

PROTECTION
Chiffrement en transit (HTTPS), cloisonnement strict des accès par rôle (Row Level Security), documents médicaux stockés dans un espace privé accessible aux seuls participants via des liens signés à durée limitée, consultations vidéo dans des salles à identifiant unique non listé.

VOS DROITS
Accès, rectification et suppression de vos données : [À COMPLÉTER : e-mail du responsable de traitement]. Cadre applicable : loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel et régulateur ARTCI. [À VALIDER par un juriste : formalités de déclaration/autorisation ARTCI pour les données de santé.]

CONSENTEMENT
L''inscription requiert l''acceptation explicite des CGU et de la présente politique ; l''horodatage de ce consentement est conservé avec le compte.'::text)),
  ('legal_cgu', to_jsonb('OBJET
Les présentes CGU encadrent l''utilisation de Santé Facile par les patients, médecins, pharmacies et assureurs. L''utilisation vaut acceptation.

RÔLE DE LA PLATEFORME
Santé Facile fournit un outil technique de mise en relation et de transmission sécurisée. La responsabilité des actes médicaux incombe aux médecins ; la délivrance des médicaments aux pharmacies ; les décisions de prise en charge aux assureurs. Les comptes professionnels sont vérifiés avant activation, sans que cette vérification constitue une garantie d''exercice. [À VALIDER : périmètre de responsabilité exact.]

URGENCES
La plateforme ne remplace pas les services d''urgence. Le bouton « Urgence » facilite une mise en relation prioritaire mais ne garantit pas la disponibilité immédiate d''un médecin : en cas d''urgence vitale, appelez le 185 (SAMU).

COMPTES ET SÉCURITÉ
Identifiants strictement personnels. Tout usage frauduleux (usurpation de rôle, fausses ordonnances) entraîne la suspension du compte et peut faire l''objet de poursuites.

TARIFS
L''inscription patient est gratuite. Les tarifs des consultations, médicaments et livraisons sont fixés par les professionnels partenaires et affichés avant validation. [À COMPLÉTER lors de l''activation du paiement en ligne.]

DROIT APPLICABLE
Droit ivoirien. Juridictions compétentes : tribunaux d''Abidjan. [À VALIDER.]'::text))
on conflict (key) do nothing;
