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
