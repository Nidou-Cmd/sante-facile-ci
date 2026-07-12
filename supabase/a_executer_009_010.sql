-- ============================================================
-- SANTÉ FACILE — P0 Confiance & Sécurité :
--   1. Notifications in-app (4 moments clés) + Realtime
--   2. Horodatage du consentement CGU à l'inscription
-- Fichier : supabase/migrations/009_p0_confiance_notifications.sql
-- Prérequis : scripts 001 à 008 déjà exécutés
-- ============================================================

-- ------------------------------------------------------------
-- 1. Consentement CGU : colonne + trigger d'inscription mis à jour
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists accepted_terms_at timestamptz;

comment on column public.profiles.accepted_terms_at is
  'Horodatage de l''acceptation des CGU/politique de confidentialité à l''inscription (preuve de consentement — modalités à valider par un juriste).';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'patient');
  safe_role public.user_role;
begin
  if requested_role in ('patient', 'medecin', 'pharmacie', 'assureur') then
    safe_role := requested_role::public.user_role;
  else
    safe_role := 'patient';
  end if;

  insert into public.profiles (id, role, full_name, email, phone, is_verified, accepted_terms_at)
  values (
    new.id,
    safe_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    safe_role = 'patient',
    nullif(new.raw_user_meta_data ->> 'accepted_terms_at', '')::timestamptz
  );
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. Notifications in-app
-- ------------------------------------------------------------
create table public.sante_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  link_path text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.sante_notifications (user_id, is_read, created_at desc);

alter table public.sante_notifications enable row level security;

create policy "notifications_select_own"
  on public.sante_notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.sante_notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pas de policy INSERT : seules les fonctions/trigger SECURITY DEFINER créent des notifications.

alter publication supabase_realtime add table public.sante_notifications;

-- Aide interne
create or replace function public.notify_user(p_user uuid, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.sante_notifications (user_id, title, body, link_path)
  select p_user, p_title, p_body, p_link
  where p_user is not null;
$$;

-- ------------------------------------------------------------
-- 3. Triggers de notification — 4 moments clés + messagerie
-- ------------------------------------------------------------

-- 3a. Rendez-vous : nouvelle demande → médecin ; confirmation/annulation/fin → patient
create or replace function public.notify_appointment_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_emergency and new.medecin_id is not null then
      perform public.notify_user(new.medecin_id, '📅 Nouvelle demande de rendez-vous',
        coalesce(nullif(new.patient_name, ''), 'Un patient') || ' propose un créneau.', '/medecin/agenda');
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'confirme' then
      perform public.notify_user(new.patient_id,
        case when new.is_emergency then '🚨 Un médecin a pris votre urgence en charge'
             else '✅ Rendez-vous confirmé' end,
        case when new.is_emergency then 'Dr ' || coalesce(nullif(new.medecin_name, ''), '—') || ' vous attend en vidéo.'
             else 'Dr ' || coalesce(nullif(new.medecin_name, ''), '—') || ' a confirmé votre créneau.' end,
        '/consultation/' || new.id);
    elsif new.status = 'annule' then
      perform public.notify_user(new.patient_id, '❌ Rendez-vous annulé',
        'Votre rendez-vous a été annulé.', '/patient/rendez-vous');
      perform public.notify_user(new.medecin_id, '❌ Rendez-vous annulé',
        'Le rendez-vous avec ' || coalesce(nullif(new.patient_name, ''), 'un patient') || ' a été annulé.', '/medecin/agenda');
    elsif new.status = 'termine' then
      perform public.notify_user(new.patient_id, '🩺 Consultation terminée',
        'Votre ordonnance éventuelle apparaîtra dans « Mes ordonnances ».', '/patient/ordonnances');
    end if;
  end if;
  return new;
end;
$$;

create trigger appointments_notify
  after insert or update on public.appointments
  for each row execute function public.notify_appointment_events();

-- 3b. Ordonnances : émission → patient + officine destinataire
create or replace function public.notify_prescription_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if tg_op = 'INSERT' then
    perform public.notify_user(new.patient_id, '📄 Nouvelle ordonnance',
      'Dr ' || coalesce(nullif(new.medecin_name, ''), '—') || ' vous a prescrit un traitement' ||
      case when new.pharmacy_name <> '' then ' (envoyé à ' || new.pharmacy_name || ')' else '' end || '.',
      '/patient/ordonnances');
    if new.pharmacy_id is not null then
      select owner_profile_id into v_owner from public.pharmacies where id = new.pharmacy_id;
      perform public.notify_user(v_owner, '📥 Nouvelle commande',
        'Ordonnance de ' || coalesce(nullif(new.patient_name, ''), 'un patient') || ' à préparer.',
        '/pharmacie/commandes');
    end if;
  end if;
  return new;
end;
$$;

create trigger prescriptions_notify
  after insert on public.prescriptions
  for each row execute function public.notify_prescription_events();

-- 3c. Livraisons : chaque étape → patient
create or replace function public.notify_delivery_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_user(new.patient_id, '📦 Préparation commencée',
      'Votre pharmacie prépare vos médicaments.', '/patient/livraisons');
  elsif new.status is distinct from old.status then
    if new.status = 'en_route' then
      perform public.notify_user(new.patient_id, '🛵 Livraison en route',
        coalesce(nullif(new.courier_name, ''), 'Votre livreur') ||
        case when new.courier_phone <> '' then ' (' || new.courier_phone || ')' else '' end ||
        ' est en chemin.', '/patient/livraisons');
    elsif new.status = 'livre' then
      perform public.notify_user(new.patient_id, '✅ Commande livrée',
        'Vos médicaments ont été livrés. Bon rétablissement !', '/patient/livraisons');
    end if;
  end if;
  return new;
end;
$$;

create trigger deliveries_notify
  after insert or update on public.sante_deliveries
  for each row execute function public.notify_delivery_events();

-- 3d. Prise en charge : demande → assureur ; décision → patient
create or replace function public.notify_coverage_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_user(new.insurer_profile_id, '🧾 Nouvelle demande de prise en charge',
      coalesce(nullif(new.patient_name, ''), 'Un assuré') || ' demande une prise en charge.',
      '/assureur/demandes');
  elsif new.status is distinct from old.status and new.status <> 'en_attente' then
    perform public.notify_user(new.patient_id, '🛡️ Décision de prise en charge',
      case new.status
        when 'approuvee_totale' then 'Prise en charge approuvée à 100 %.'
        when 'approuvee_partielle' then 'Prise en charge partielle approuvée (' || coalesce(new.covered_percent, 0) || ' %).'
        else 'Votre demande de prise en charge a été refusée.'
      end,
      '/patient/ordonnances');
  end if;
  return new;
end;
$$;

create trigger coverage_notify
  after insert or update on public.coverage_requests
  for each row execute function public.notify_coverage_events();

-- 3e. Messagerie : nouveau message → l'autre participant
create or replace function public.notify_message_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient uuid;
  v_medecin uuid;
  v_target uuid;
begin
  select patient_id, medecin_id into v_patient, v_medecin
  from public.conversations where id = new.conversation_id;
  v_target := case when new.sender_id = v_patient then v_medecin else v_patient end;
  perform public.notify_user(v_target, '💬 Nouveau message',
    case when new.file_path is not null then 'Un document vous a été partagé.'
         else left(new.content, 80) end,
    '/messages');
  return new;
end;
$$;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_message_events();
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
