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
