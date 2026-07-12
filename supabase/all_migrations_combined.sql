-- ============================================================
-- SANTÉ FACILE — Module 1 : Authentification multi-rôles
-- Fichier : supabase/migrations/001_auth_multi_roles.sql
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enum des 5 rôles de la plateforme
-- ------------------------------------------------------------
create type public.user_role as enum ('patient', 'medecin', 'pharmacie', 'assureur', 'admin');

-- ------------------------------------------------------------
-- 2. Table des profils (liée 1-1 à auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'patient',
  full_name text not null default '',
  email text not null default '',
  phone text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil applicatif de chaque utilisateur Santé Facile (1 ligne par compte auth.users).';
comment on column public.profiles.is_verified is
  'true = compte actif. Les patients sont vérifiés automatiquement ; les professionnels (médecin, pharmacie, assureur) doivent être validés par un admin.';

-- ------------------------------------------------------------
-- 3. Row Level Security activée
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

-- ------------------------------------------------------------
-- 4. Fonction utilitaire : rôle de l'utilisateur courant
--    SECURITY DEFINER → évite la récursion RLS dans les policies
--    (la fonction lit profiles en tant que propriétaire de la table).
-- ------------------------------------------------------------
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 5. Création automatique du profil à l'inscription
--    Le rôle demandé est lu dans les métadonnées d'inscription.
--    SÉCURITÉ :
--      - le rôle 'admin' ne peut PAS être choisi à l'inscription
--        (toute tentative retombe sur 'patient') ;
--      - les patients sont vérifiés immédiatement ;
--      - les rôles professionnels démarrent NON vérifiés et
--        doivent être validés par un admin.
-- ------------------------------------------------------------
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

  insert into public.profiles (id, role, full_name, email, phone, is_verified)
  values (
    new.id,
    safe_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    safe_role = 'patient'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 6. Protection contre l'auto-escalade de privilèges
--    Seul un admin (ou une exécution hors session utilisateur :
--    SQL Editor / clé service_role) peut modifier role,
--    is_verified ou email. Les utilisateurs peuvent modifier
--    leurs autres champs (nom, téléphone).
-- ------------------------------------------------------------
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.is_verified is distinct from old.is_verified
      or new.email is distinct from old.email) then
    if auth.uid() is not null and coalesce(public.get_my_role()::text, '') <> 'admin' then
      raise exception 'Seul un administrateur peut modifier le rôle, l''e-mail ou le statut de vérification.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger before_profile_update
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- ------------------------------------------------------------
-- 7. Policies RLS
-- ------------------------------------------------------------

-- Lecture : chacun voit son propre profil
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Lecture : un admin voit tous les profils
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.get_my_role() = 'admin');

-- Mise à jour : chacun modifie son propre profil
-- (role / is_verified / email restent protégés par le trigger du §6)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Mise à jour : un admin peut modifier tous les profils
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- Pas de policy INSERT : la création passe uniquement par le
-- trigger handle_new_user (SECURITY DEFINER).
-- Pas de policy DELETE : la suppression suit la suppression du
-- compte auth.users (ON DELETE CASCADE).

-- ============================================================
-- 8. PROMOTION D'UN ADMINISTRATEUR (opération manuelle, une fois)
--    a) Créez d'abord un compte normalement via l'application
--    b) Puis exécutez dans le SQL Editor (adaptez l'e-mail) :
--
--    update public.profiles
--    set role = 'admin', is_verified = true
--    where email = 'votre-email-admin@exemple.ci';
-- ============================================================
-- ============================================================
-- SANTÉ FACILE — Module 2 : Profil patient + géolocalisation
--                + pharmacies partenaires + calcul de proximité
-- Fichier : supabase/migrations/002_geolocalisation_pharmacies.sql
-- Prérequis : 001_auth_multi_roles.sql déjà exécuté
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ------------------------------------------------------------
-- 1. Utilitaire : mise à jour automatique de updated_at
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. Table des pharmacies partenaires (fiche officine)
--    owner_profile_id NULL = pharmacie partenaire pré-enregistrée
--    par l'équipe Santé Facile, sans compte utilisateur encore lié
--    (architecture "branchable" : les vrais partenariats se négocient
--    séparément, puis on lie le compte de l'officine à sa fiche).
-- ------------------------------------------------------------
create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  address_line text not null default '',
  commune text not null default '',
  city text not null default 'Abidjan',
  lat double precision,
  lng double precision,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pharmacies is
  'Fiches des pharmacies partenaires (localisation, contact). owner_profile_id relie la fiche au compte de rôle pharmacie.';

create trigger pharmacies_updated_at
  before update on public.pharmacies
  for each row execute function public.set_updated_at();

-- Garde : si un compte est lié, il doit être de rôle "pharmacie"
create or replace function public.ensure_pharmacy_owner_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_profile_id is not null
     and (select role from public.profiles where id = new.owner_profile_id) is distinct from 'pharmacie' then
    raise exception 'owner_profile_id doit correspondre à un compte de rôle pharmacie.';
  end if;
  return new;
end;
$$;

create trigger pharmacies_owner_role
  before insert or update on public.pharmacies
  for each row execute function public.ensure_pharmacy_owner_role();

alter table public.pharmacies enable row level security;

-- Lecture : tout utilisateur connecté (les patients doivent voir les
-- pharmacies proches ; la localisation d'une officine est publique)
create policy "pharmacies_select_authenticated"
  on public.pharmacies for select
  to authenticated
  using (true);

-- Création : une pharmacie crée SA fiche (ou un admin)
create policy "pharmacies_insert_own"
  on public.pharmacies for insert
  to authenticated
  with check (
    (owner_profile_id = auth.uid() and public.get_my_role() = 'pharmacie')
    or public.get_my_role() = 'admin'
  );

-- Mise à jour : le propriétaire de la fiche (ou un admin)
create policy "pharmacies_update_own"
  on public.pharmacies for update
  to authenticated
  using (owner_profile_id = auth.uid() or public.get_my_role() = 'admin')
  with check (owner_profile_id = auth.uid() or public.get_my_role() = 'admin');

-- ------------------------------------------------------------
-- 3. Profil patient : adresse + position GPS + pharmacie préférée
-- ------------------------------------------------------------
create table public.patient_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  address_line text not null default '',
  commune text not null default '',
  city text not null default 'Abidjan',
  lat double precision,
  lng double precision,
  preferred_pharmacy_id uuid references public.pharmacies (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.patient_profiles is
  'Adresse et géolocalisation du patient + pharmacie préférée (calculée par proximité, modifiable).';

create trigger patient_profiles_updated_at
  before update on public.patient_profiles
  for each row execute function public.set_updated_at();

-- Garde : réservé aux comptes de rôle "patient"
create or replace function public.ensure_patient_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select role from public.profiles where id = new.id) is distinct from 'patient' then
    raise exception 'patient_profiles : réservé aux comptes de rôle patient.';
  end if;
  return new;
end;
$$;

create trigger patient_profiles_role
  before insert on public.patient_profiles
  for each row execute function public.ensure_patient_role();

alter table public.patient_profiles enable row level security;

create policy "patient_profiles_select_own"
  on public.patient_profiles for select
  using (auth.uid() = id);

create policy "patient_profiles_select_admin"
  on public.patient_profiles for select
  using (public.get_my_role() = 'admin');

create policy "patient_profiles_insert_own"
  on public.patient_profiles for insert
  with check (auth.uid() = id);

create policy "patient_profiles_update_own"
  on public.patient_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- 4. RPC : pharmacies les plus proches (formule de Haversine)
--    SECURITY DEFINER : ne renvoie que des champs publics de la
--    fiche pharmacie + filtre les officines liées à un compte
--    non vérifié par un admin.
-- ------------------------------------------------------------
create or replace function public.nearest_pharmacies(
  p_lat double precision,
  p_lng double precision,
  p_limit integer default 5
)
returns table (
  id uuid,
  name text,
  address_line text,
  commune text,
  city text,
  lat double precision,
  lng double precision,
  phone text,
  distance_km double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.name,
    p.address_line,
    p.commune,
    p.city,
    p.lat,
    p.lng,
    p.phone,
    round(
      (6371 * 2 * asin(sqrt(
        power(sin(radians((p.lat - p_lat) / 2)), 2)
        + cos(radians(p_lat)) * cos(radians(p.lat))
          * power(sin(radians((p.lng - p_lng) / 2)), 2)
      )))::numeric, 2
    )::double precision as distance_km
  from public.pharmacies p
  where p.is_active
    and p.lat is not null
    and p.lng is not null
    and (
      p.owner_profile_id is null  -- partenaire pré-enregistré par l'équipe
      or exists (
        select 1 from public.profiles pr
        where pr.id = p.owner_profile_id and pr.is_verified
      )
    )
  order by distance_km asc
  limit greatest(coalesce(p_limit, 5), 1)
$$;

-- ============================================================
-- 5. (OPTIONNEL — TESTS UNIQUEMENT) Pharmacies FICTIVES d'Abidjan
--    ⚠️ Données d'EXEMPLE à valider/remplacer : ce ne sont PAS de
--    vrais partenaires. Coordonnées approximatives par commune.
--    Décommentez ce bloc pour tester le calcul de proximité.
-- ============================================================
-- insert into public.pharmacies (name, address_line, commune, lat, lng, phone) values
--   ('Pharmacie Test Cocody (fictive)',      'Bd Latrille (exemple)',   'Cocody',      5.3444, -3.9874, '+225 07 00 00 01'),
--   ('Pharmacie Test Plateau (fictive)',     'Av. Chardy (exemple)',    'Plateau',     5.3249, -4.0210, '+225 07 00 00 02'),
--   ('Pharmacie Test Yopougon (fictive)',    'Rue Princesse (exemple)', 'Yopougon',    5.3364, -4.0893, '+225 07 00 00 03'),
--   ('Pharmacie Test Marcory (fictive)',     'Bd VGE (exemple)',        'Marcory',     5.3014, -3.9814, '+225 07 00 00 04'),
--   ('Pharmacie Test Treichville (fictive)', 'Av. 16 (exemple)',        'Treichville', 5.2932, -4.0126, '+225 07 00 00 05');
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
-- ============================================================
-- SANTÉ FACILE — Module 5 : Prescription électronique
-- Fichier : supabase/migrations/004_prescriptions.sql
-- Prérequis : scripts 001 à 003 déjà exécutés
-- ============================================================

create type public.prescription_status as enum
  ('emise', 'en_preparation', 'en_livraison', 'livree', 'annulee');

-- ------------------------------------------------------------
-- 1. Ordonnances électroniques
--    pharmacy_id est sélectionnée AUTOMATIQUEMENT : pharmacie
--    préférée du patient, sinon la plus proche de chez lui.
-- ------------------------------------------------------------
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments (id) on delete set null,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  medecin_id uuid not null references public.profiles (id) on delete cascade,
  pharmacy_id uuid references public.pharmacies (id) on delete set null,
  patient_name text not null default '',
  medecin_name text not null default '',
  pharmacy_name text not null default '',
  diagnosis text not null default '',
  status public.prescription_status not null default 'emise',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prescriptions_patient_idx on public.prescriptions (patient_id, created_at desc);
create index prescriptions_medecin_idx on public.prescriptions (medecin_id, created_at desc);
create index prescriptions_pharmacy_idx on public.prescriptions (pharmacy_id, status);

create trigger prescriptions_updated_at
  before update on public.prescriptions
  for each row execute function public.set_updated_at();

alter table public.prescriptions enable row level security;

-- Lecture : patient concerné, médecin auteur, officine destinataire, admin
create policy "prescriptions_select"
  on public.prescriptions for select to authenticated
  using (
    patient_id = auth.uid()
    or medecin_id = auth.uid()
    or exists (
      select 1 from public.pharmacies ph
      where ph.id = prescriptions.pharmacy_id and ph.owner_profile_id = auth.uid()
    )
    or public.get_my_role() = 'admin'
  );

-- Création : uniquement un médecin VÉRIFIÉ, auteur de l'ordonnance
create policy "prescriptions_insert_medecin"
  on public.prescriptions for insert to authenticated
  with check (
    medecin_id = auth.uid()
    and public.get_my_role() = 'medecin'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_verified)
  );

-- Mise à jour : médecin auteur (annulation), officine destinataire
-- (progression des statuts), admin
create policy "prescriptions_update"
  on public.prescriptions for update to authenticated
  using (
    medecin_id = auth.uid()
    or exists (
      select 1 from public.pharmacies ph
      where ph.id = prescriptions.pharmacy_id and ph.owner_profile_id = auth.uid()
    )
    or public.get_my_role() = 'admin'
  )
  with check (true);

-- ------------------------------------------------------------
-- 2. Lignes de l'ordonnance (médicaments)
-- ------------------------------------------------------------
create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete cascade,
  medication_name text not null,
  dosage text not null default '',
  frequency text not null default '',
  duration text not null default '',
  instructions text not null default '',
  created_at timestamptz not null default now()
);

create index prescription_items_parent_idx on public.prescription_items (prescription_id);

alter table public.prescription_items enable row level security;

-- Visible si l'ordonnance parente est visible (RLS parent réutilisée)
create policy "prescription_items_select"
  on public.prescription_items for select to authenticated
  using (
    exists (select 1 from public.prescriptions pr where pr.id = prescription_items.prescription_id)
  );

-- Création : le médecin auteur de l'ordonnance parente
create policy "prescription_items_insert"
  on public.prescription_items for insert to authenticated
  with check (
    exists (
      select 1 from public.prescriptions pr
      where pr.id = prescription_items.prescription_id and pr.medecin_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 3. Sélection automatique de la pharmacie du patient :
--    1) sa pharmacie préférée si active, sinon
--    2) la plus proche de sa position enregistrée.
--    Réservé aux médecins/admins (SECURITY DEFINER + contrôle).
-- ------------------------------------------------------------
create or replace function public.select_pharmacy_for_patient(p_patient uuid)
returns table (pharmacy_id uuid, pharmacy_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pref uuid;
  v_lat double precision;
  v_lng double precision;
begin
  if public.get_my_role() not in ('medecin', 'admin') then
    raise exception 'Accès réservé aux médecins.';
  end if;

  select pp.preferred_pharmacy_id, pp.lat, pp.lng
  into v_pref, v_lat, v_lng
  from public.patient_profiles pp
  where pp.id = p_patient;

  if v_pref is not null then
    return query
      select ph.id, ph.name from public.pharmacies ph
      where ph.id = v_pref and ph.is_active;
    if found then
      return;
    end if;
  end if;

  if v_lat is not null and v_lng is not null then
    return query
      select np.id, np.name from public.nearest_pharmacies(v_lat, v_lng, 1) np;
  end if;

  return;
end;
$$;
-- ============================================================
-- SANTÉ FACILE — Module 6 : Stock basique de la pharmacie
-- Fichier : supabase/migrations/005_stock_pharmacie.sql
-- Prérequis : scripts 001 à 004 déjà exécutés
-- ============================================================

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  medication_name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  price_fcfa integer check (price_fcfa is null or price_fcfa >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stock_items_pharmacy_idx on public.stock_items (pharmacy_id, medication_name);

create trigger stock_items_updated_at
  before update on public.stock_items
  for each row execute function public.set_updated_at();

alter table public.stock_items enable row level security;

-- Le stock est PRIVÉ : seule l'officine propriétaire (et l'admin) y accède
create policy "stock_select_own"
  on public.stock_items for select to authenticated
  using (
    exists (select 1 from public.pharmacies ph where ph.id = stock_items.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  );

create policy "stock_insert_own"
  on public.stock_items for insert to authenticated
  with check (
    exists (select 1 from public.pharmacies ph where ph.id = stock_items.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  );

create policy "stock_update_own"
  on public.stock_items for update to authenticated
  using (
    exists (select 1 from public.pharmacies ph where ph.id = stock_items.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  )
  with check (
    exists (select 1 from public.pharmacies ph where ph.id = stock_items.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  );

create policy "stock_delete_own"
  on public.stock_items for delete to authenticated
  using (
    exists (select 1 from public.pharmacies ph where ph.id = stock_items.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  );
-- ============================================================
-- SANTÉ FACILE — Module 7 : Suivi de livraison en temps réel
-- Fichier : supabase/migrations/006_livraisons.sql
-- Prérequis : scripts 001 à 005 déjà exécutés
-- ============================================================

create type public.delivery_status as enum ('preparation', 'en_route', 'livre');

-- ------------------------------------------------------------
-- 1. Livraisons (une par ordonnance)
--    Statuts : preparation → en_route → livre
--    Suivi temps réel côté patient via Supabase Realtime.
-- ------------------------------------------------------------
create table public.sante_deliveries (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null unique references public.prescriptions (id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  courier_name text not null default '',
  courier_phone text not null default '',
  status public.delivery_status not null default 'preparation',
  started_at timestamptz not null default now(),
  en_route_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deliveries_patient_idx on public.sante_deliveries (patient_id, created_at desc);
create index deliveries_pharmacy_idx on public.sante_deliveries (pharmacy_id, status);

create trigger sante_deliveries_updated_at
  before update on public.sante_deliveries
  for each row execute function public.set_updated_at();

alter table public.sante_deliveries enable row level security;

-- Lecture : patient destinataire, officine expéditrice, admin
create policy "deliveries_select"
  on public.sante_deliveries for select to authenticated
  using (
    patient_id = auth.uid()
    or exists (select 1 from public.pharmacies ph where ph.id = sante_deliveries.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  );

-- Création / mise à jour : l'officine expéditrice (ou admin)
create policy "deliveries_insert_pharmacy"
  on public.sante_deliveries for insert to authenticated
  with check (
    exists (select 1 from public.pharmacies ph where ph.id = sante_deliveries.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  );

create policy "deliveries_update_pharmacy"
  on public.sante_deliveries for update to authenticated
  using (
    exists (select 1 from public.pharmacies ph where ph.id = sante_deliveries.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  )
  with check (
    exists (select 1 from public.pharmacies ph where ph.id = sante_deliveries.pharmacy_id and ph.owner_profile_id = auth.uid())
    or public.get_my_role() = 'admin'
  );

-- ------------------------------------------------------------
-- 2. Activation du temps réel (Supabase Realtime)
--    Le patient reçoit les changements de statut en direct.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.sante_deliveries;
-- ============================================================
-- SANTÉ FACILE — Module 8 : Assureur (éligibilité, prise en
--                charge, remboursements)
-- Fichier : supabase/migrations/007_assurance.sql
-- Prérequis : scripts 001 à 006 déjà exécutés
--
-- 💰 MODÈLE DE REVENU (à définir avec les partenaires — exemple
-- à valider) : commission par transaction validée OU abonnement
-- partenaire. La constante d'exemple est dans src/lib/config.ts.
-- ============================================================

create type public.policy_status as enum ('actif', 'suspendu');
create type public.coverage_status as enum
  ('en_attente', 'approuvee_totale', 'approuvee_partielle', 'refusee');

-- ------------------------------------------------------------
-- 1. Polices d'assurance (éligibilité)
--    L'assureur enregistre les patients couverts par son organisme.
-- ------------------------------------------------------------
create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  insurer_profile_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  insurer_name text not null default '',
  patient_name text not null default '',
  policy_number text not null,
  coverage_percent integer not null default 80 check (coverage_percent between 0 and 100),
  status public.policy_status not null default 'actif',
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (insurer_profile_id, patient_id)
);

create index policies_insurer_idx on public.insurance_policies (insurer_profile_id);
create index policies_patient_idx on public.insurance_policies (patient_id, status);

create trigger insurance_policies_updated_at
  before update on public.insurance_policies
  for each row execute function public.set_updated_at();

alter table public.insurance_policies enable row level security;

-- Lecture : l'assureur émetteur, le patient couvert, l'admin
create policy "policies_select"
  on public.insurance_policies for select to authenticated
  using (
    insurer_profile_id = auth.uid()
    or patient_id = auth.uid()
    or public.get_my_role() = 'admin'
  );

-- Création / mise à jour : uniquement un assureur VÉRIFIÉ (ou admin)
create policy "policies_insert_insurer"
  on public.insurance_policies for insert to authenticated
  with check (
    (insurer_profile_id = auth.uid()
     and public.get_my_role() = 'assureur'
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_verified))
    or public.get_my_role() = 'admin'
  );

create policy "policies_update_insurer"
  on public.insurance_policies for update to authenticated
  using (insurer_profile_id = auth.uid() or public.get_my_role() = 'admin')
  with check (insurer_profile_id = auth.uid() or public.get_my_role() = 'admin');

-- ------------------------------------------------------------
-- 2. Demandes de prise en charge (une par ordonnance)
--    Le patient demande la prise en charge d'une ordonnance ;
--    l'assureur approuve (totale/partielle) ou refuse.
--    Une demande approuvée = un "remboursement" dans l'historique.
-- ------------------------------------------------------------
create table public.coverage_requests (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null unique references public.prescriptions (id) on delete cascade,
  policy_id uuid not null references public.insurance_policies (id) on delete cascade,
  insurer_profile_id uuid not null references public.profiles (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  patient_name text not null default '',
  status public.coverage_status not null default 'en_attente',
  covered_percent integer check (covered_percent is null or covered_percent between 0 and 100),
  amount_fcfa integer check (amount_fcfa is null or amount_fcfa >= 0),
  notes text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coverage_insurer_idx on public.coverage_requests (insurer_profile_id, status);
create index coverage_patient_idx on public.coverage_requests (patient_id, created_at desc);

create trigger coverage_requests_updated_at
  before update on public.coverage_requests
  for each row execute function public.set_updated_at();

alter table public.coverage_requests enable row level security;

create policy "coverage_select"
  on public.coverage_requests for select to authenticated
  using (
    patient_id = auth.uid()
    or insurer_profile_id = auth.uid()
    or public.get_my_role() = 'admin'
  );

-- Création : le patient, pour SA propre ordonnance et SA propre police
create policy "coverage_insert_patient"
  on public.coverage_requests for insert to authenticated
  with check (
    patient_id = auth.uid()
    and exists (select 1 from public.prescriptions pr where pr.id = prescription_id and pr.patient_id = auth.uid())
    and exists (select 1 from public.insurance_policies ip where ip.id = policy_id and ip.patient_id = auth.uid() and ip.status = 'actif')
  );

-- Décision : l'assureur concerné (ou admin)
create policy "coverage_update_insurer"
  on public.coverage_requests for update to authenticated
  using (insurer_profile_id = auth.uid() or public.get_my_role() = 'admin')
  with check (insurer_profile_id = auth.uid() or public.get_my_role() = 'admin');

-- ------------------------------------------------------------
-- 3. L'assureur doit pouvoir consulter l'ordonnance liée à une
--    demande qui lui est adressée (extension RLS prescriptions)
-- ------------------------------------------------------------
create policy "prescriptions_select_insurer"
  on public.prescriptions for select to authenticated
  using (
    exists (
      select 1 from public.coverage_requests cr
      where cr.prescription_id = prescriptions.id and cr.insurer_profile_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4. Recherche d'un patient par e-mail (vérification d'éligibilité)
--    Réservée aux assureurs vérifiés et admins. N'expose que
--    l'identifiant et le nom.
-- ------------------------------------------------------------
create or replace function public.find_patient_by_email(p_email text)
returns table (id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.get_my_role() not in ('assureur', 'admin') then
    raise exception 'Accès réservé aux assureurs.';
  end if;
  if public.get_my_role() = 'assureur'
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_verified) then
    raise exception 'Compte assureur non vérifié.';
  end if;

  return query
    select p.id, p.full_name
    from public.profiles p
    where p.role = 'patient' and lower(p.email) = lower(trim(p_email));
end;
$$;
-- ============================================================
-- SANTÉ FACILE — Module 9 : Chat sécurisé & documents médicaux
-- Fichier : supabase/migrations/008_chat_documents.sql
-- Prérequis : scripts 001 à 007 déjà exécutés
-- ============================================================

-- ------------------------------------------------------------
-- 1. Conversations patient ↔ médecin (une par binôme)
-- ------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  medecin_id uuid not null references public.profiles (id) on delete cascade,
  patient_name text not null default '',
  medecin_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, medecin_id)
);

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

alter table public.conversations enable row level security;

create policy "conversations_select_participants"
  on public.conversations for select to authenticated
  using (patient_id = auth.uid() or medecin_id = auth.uid() or public.get_my_role() = 'admin');

-- Création : par le patient (avec un médecin vérifié) ou par le médecin
create policy "conversations_insert_participants"
  on public.conversations for insert to authenticated
  with check (
    (patient_id = auth.uid() and public.get_my_role() = 'patient')
    or (medecin_id = auth.uid() and public.get_my_role() = 'medecin')
  );

create policy "conversations_update_participants"
  on public.conversations for update to authenticated
  using (patient_id = auth.uid() or medecin_id = auth.uid())
  with check (patient_id = auth.uid() or medecin_id = auth.uid());

-- ------------------------------------------------------------
-- 2. Messages (texte et/ou document joint)
-- ------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '',
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create policy "messages_select_participants"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.patient_id = auth.uid() or c.medecin_id = auth.uid())
    )
  );

create policy "messages_insert_participants"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.patient_id = auth.uid() or c.medecin_id = auth.uid())
    )
  );

-- Temps réel sur les messages
alter publication supabase_realtime add table public.messages;

-- ------------------------------------------------------------
-- 3. Stockage des documents médicaux (bucket privé)
--    Chemin imposé : {uid_de_l_expediteur}/{horodatage}-{fichier}
--    Lecture : l'expéditeur + les participants de la conversation
--    où le document a été partagé.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('medical-documents', 'medical-documents', false)
on conflict (id) do nothing;

create policy "docs_upload_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "docs_read_participants"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'medical-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.messages m
        join public.conversations c on c.id = m.conversation_id
        where m.file_path = storage.objects.name
          and (c.patient_id = auth.uid() or c.medecin_id = auth.uid())
      )
    )
  );

-- ============================================================
-- SEED DE TEST (pharmacies partenaires FICTIVES d'Abidjan)
-- ⚠️ Données d'EXEMPLE — owner_profile_id NULL = fiches publiques
-- pré-enregistrées, visibles dans nearest_pharmacies sans compte lié.
-- À SUPPRIMER avant toute mise en production.
-- ============================================================
insert into public.pharmacies (name, address_line, commune, lat, lng, phone) values
  ('Pharmacie Test Cocody (fictive)',      'Bd Latrille (exemple)',   'Cocody',      5.3444, -3.9874, '+225 07 00 00 01'),
  ('Pharmacie Test Plateau (fictive)',     'Av. Chardy (exemple)',    'Plateau',     5.3249, -4.0210, '+225 07 00 00 02'),
  ('Pharmacie Test Yopougon (fictive)',    'Rue Princesse (exemple)', 'Yopougon',    5.3364, -4.0893, '+225 07 00 00 03'),
  ('Pharmacie Test Marcory (fictive)',     'Bd VGE (exemple)',        'Marcory',     5.3014, -3.9814, '+225 07 00 00 04'),
  ('Pharmacie Test Treichville (fictive)', 'Av. 16 (exemple)',        'Treichville', 5.2932, -4.0126, '+225 07 00 00 05');
