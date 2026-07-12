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
