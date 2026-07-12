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
