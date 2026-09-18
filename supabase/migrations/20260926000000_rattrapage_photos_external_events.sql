-- Rattrapage : deux tables et un bucket créés directement sur le projet
-- (sans fichier de migration) le 03/09/2026 environ. Ce fichier remet
-- le dépôt en accord avec la base pour qu'une reconstruction à partir
-- des migrations soit complète. Il reflète EXACTEMENT ce qui existe en
-- production (colonnes, contraintes, index, politiques) — relevé le
-- 18/09/2026 — et chaque étape est gardée : sur la base existante il
-- ne fait rien. Rien n'est modifié ni supprimé.

-- 1) intervention_photos ---------------------------------------------
create table if not exists public.intervention_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  storage_path text not null,
  legende text,
  moment text default 'autre' check (moment in ('avant', 'pendant', 'apres', 'autre')),
  ordre integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_intervention_photos_intervention
  on public.intervention_photos (intervention_id, ordre);

alter table public.intervention_photos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'intervention_photos'
  ) then
    create policy intervention_photos_owner_all on public.intervention_photos
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- 2) facture_external_events -----------------------------------------
create table if not exists public.facture_external_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  facture_id uuid not null references public.factures(id) on delete cascade,
  source text not null default 'ical_external' check (source = 'ical_external'),
  external_uid text not null,
  fallback_key text,
  snapshot_title text,
  snapshot_date_start date,
  snapshot_date_end date,
  created_at timestamptz not null default now(),
  unique (facture_id, external_uid)
);

create index if not exists idx_facture_external_events_facture
  on public.facture_external_events (facture_id);
create index if not exists idx_facture_external_events_user_uid
  on public.facture_external_events (user_id, external_uid);

alter table public.facture_external_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'facture_external_events'
  ) then
    create policy facture_external_events_owner_all on public.facture_external_events
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- 3) Bucket privé des photos d'intervention ---------------------------
insert into storage.buckets (id, name, public)
values ('intervention-photos', 'intervention-photos', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'intervention_photos_owner_read'
  ) then
    create policy intervention_photos_owner_read on storage.objects
      for select using (
        bucket_id = 'intervention-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'intervention_photos_owner_insert'
  ) then
    create policy intervention_photos_owner_insert on storage.objects
      for insert with check (
        bucket_id = 'intervention-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'intervention_photos_owner_delete'
  ) then
    create policy intervention_photos_owner_delete on storage.objects
      for delete using (
        bucket_id = 'intervention-photos'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;
