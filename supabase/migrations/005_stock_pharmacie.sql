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
