-- =============================================================================
-- Lot pense-bête mobile : tables `taches` et `taches_photos`.
--
-- Migration STRICTEMENT ADDITIVE :
--   1) taches : le pense-bête (titre, notes, échéance + heure optionnelles,
--      priorité, fait/fait_le, liens OPTIONNELS vers client / intervention /
--      devis / facture — FK nullables, on delete set null : la tâche
--      survit si le document lié disparaît)
--   2) taches_photos : calquée sur intervention_photos (le plus simple —
--      même modèle storage_path + ordre, bucket dédié `taches-photos`)
--   3) bucket privé `taches-photos` + policies par dossier {user_id}/…
--   4) interrupteur email quotidien « Tes tâches du jour » sur
--      profil_entreprise — ACTIVÉ par défaut (email à l'artisan, pas
--      aux clients)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Table taches
-- -----------------------------------------------------------------------------
create table if not exists public.taches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titre text not null check (char_length(titre) between 1 and 300),
  notes text check (char_length(notes) <= 2000),
  -- Échéance optionnelle (une note rapide n'a pas forcément de date)
  date_echeance date,
  -- Heure optionnelle (n'a de sens qu'avec une date)
  heure time,
  priorite text not null default 'normale'
    check (priorite in ('normale', 'urgente')),
  fait boolean not null default false,
  fait_le timestamptz,
  -- Liens optionnels « penser à relancer le devis X » — set null :
  -- la tâche et ses photos survivent à la suppression du document lié
  client_id uuid references public.clients (id) on delete set null,
  intervention_id uuid references public.interventions (id) on delete set null,
  devis_id uuid references public.devis (id) on delete set null,
  facture_id uuid references public.factures (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists taches_user_fait_echeance_idx
  on public.taches (user_id, fait, date_echeance);

alter table public.taches enable row level security;

create policy "taches_owner_select"
  on public.taches for select using (auth.uid() = user_id);
create policy "taches_owner_insert"
  on public.taches for insert with check (auth.uid() = user_id);
create policy "taches_owner_update"
  on public.taches for update using (auth.uid() = user_id);
create policy "taches_owner_delete"
  on public.taches for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2) Table taches_photos (même modèle que intervention_photos)
-- -----------------------------------------------------------------------------
create table if not exists public.taches_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tache_id uuid not null references public.taches (id) on delete cascade,
  storage_path text not null,
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists taches_photos_tache_idx
  on public.taches_photos (tache_id);

alter table public.taches_photos enable row level security;

create policy "taches_photos_owner_select"
  on public.taches_photos for select using (auth.uid() = user_id);
create policy "taches_photos_owner_insert"
  on public.taches_photos for insert with check (auth.uid() = user_id);
create policy "taches_photos_owner_delete"
  on public.taches_photos for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3) Bucket privé des photos de tâches
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('taches-photos', 'taches-photos', false)
  on conflict (id) do nothing;

create policy "storage_taches_photos_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'taches-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_taches_photos_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'taches-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_taches_photos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'taches-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- -----------------------------------------------------------------------------
-- 4) Interrupteur email quotidien « Tes tâches du jour »
--    (email à l'artisan uniquement → activé par défaut, hors simulation)
-- -----------------------------------------------------------------------------
alter table public.profil_entreprise
  add column if not exists auto_email_taches_active boolean not null default true;
