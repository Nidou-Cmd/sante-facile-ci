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
