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
