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
