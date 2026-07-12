-- ============================================================
-- SANTÉ FACILE — Module 3 : Réservation & urgence
-- Fichier : supabase/migrations/003_reservation_urgence.sql
-- Prérequis : scripts 001 et 002 déjà exécutés
-- ============================================================

-- ------------------------------------------------------------
-- 1. Statuts de rendez-vous
-- ------------------------------------------------------------
create type public.appointment_status as enum ('en_attente', 'confirme', 'annule', 'termine');

-- ------------------------------------------------------------
-- 2. Profil médecin : spécialité + disponibilité immédiate
--    (is_available_now alimente la file d'urgence)
-- ------------------------------------------------------------
create table public.medecin_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  speciality text not null default 'Médecine générale',
  is_available_now boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger medecin_profiles_updated_at
  before update on public.medecin_profiles
  for each row execute function public.set_updated_at();

create or replace function public.ensure_medecin_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.profiles where id = new.id) is distinct from 'medecin' then
    raise exception 'medecin_profiles : réservé aux comptes de rôle medecin.';
  end if;
  return new;
end;
$$;

create trigger medecin_profiles_role
  before insert on public.medecin_profiles
  for each row execute function public.ensure_medecin_role();

alter table public.medecin_profiles enable row level security;

create policy "medecin_profiles_select_authenticated"
  on public.medecin_profiles for select to authenticated using (true);

create policy "medecin_profiles_insert_own"
  on public.medecin_profiles for insert to authenticated
  with check (id = auth.uid() and public.get_my_role() = 'medecin');

create policy "medecin_profiles_update_own"
  on public.medecin_profiles for update to authenticated
  using (id = auth.uid() or public.get_my_role() = 'admin')
  with check (id = auth.uid() or public.get_my_role() = 'admin');

-- ------------------------------------------------------------
-- 3. Rendez-vous & urgences
--    Urgence = is_emergency + medecin_id NULL → visible par TOUS
--    les médecins vérifiés (file de priorité), premier à cliquer
--    « Prendre en charge » devient le médecin assigné.
--    room_code = salle Jitsi de la consultation (Module 4).
--    patient_name / medecin_name : instantanés dénormalisés pour
--    éviter des lectures croisées de profils sous RLS.
-- ------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  medecin_id uuid references public.profiles (id) on delete set null,
  patient_name text not null default '',
  medecin_name text not null default '',
  scheduled_at timestamptz,
  duration_minutes integer not null default 30,
  reason text not null default '',
  is_emergency boolean not null default false,
  status public.appointment_status not null default 'en_attente',
  room_code uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_patient_idx on public.appointments (patient_id, scheduled_at);
create index appointments_medecin_idx on public.appointments (medecin_id, scheduled_at);
create index appointments_urgence_idx on public.appointments (is_emergency, status) where medecin_id is null;

create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

-- Lecture : patient concerné, médecin assigné, ou n'importe quel
-- médecin vérifié pour les urgences non assignées, ou admin
create policy "appointments_select"
  on public.appointments for select to authenticated
  using (
    patient_id = auth.uid()
    or medecin_id = auth.uid()
    or (is_emergency and medecin_id is null and public.get_my_role() = 'medecin')
    or public.get_my_role() = 'admin'
  );

-- Création : un patient crée SES rendez-vous / urgences
create policy "appointments_insert_patient"
  on public.appointments for insert to authenticated
  with check (patient_id = auth.uid() and public.get_my_role() = 'patient');

-- Mise à jour : patient concerné (annulation), médecin assigné,
-- médecin vérifié qui PREND une urgence non assignée, ou admin
create policy "appointments_update"
  on public.appointments for update to authenticated
  using (
    patient_id = auth.uid()
    or medecin_id = auth.uid()
    or (is_emergency and medecin_id is null and public.get_my_role() = 'medecin')
    or public.get_my_role() = 'admin'
  )
  with check (
    patient_id = auth.uid()
    or medecin_id = auth.uid()
    or public.get_my_role() = 'admin'
  );

-- ------------------------------------------------------------
-- 4. Liste des médecins vérifiés (pour la prise de rendez-vous
--    et la messagerie) — SECURITY DEFINER car les profils des
--    autres utilisateurs ne sont pas lisibles sous RLS.
--    N'expose que des champs non sensibles.
-- ------------------------------------------------------------
-- Temps réel sur les rendez-vous : le patient voit sa demande
-- d'urgence acceptée en direct, sans recharger la page.
alter publication supabase_realtime add table public.appointments;

create or replace function public.list_verified_doctors()
returns table (id uuid, full_name text, speciality text, is_available_now boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         p.full_name,
         coalesce(mp.speciality, 'Médecine générale'),
         coalesce(mp.is_available_now, false)
  from public.profiles p
  left join public.medecin_profiles mp on mp.id = p.id
  where p.role = 'medecin' and p.is_verified
  order by coalesce(mp.is_available_now, false) desc, p.full_name asc
$$;
