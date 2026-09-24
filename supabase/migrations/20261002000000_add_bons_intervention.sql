-- Bons d'intervention — additif.
--
-- À la fin d'une intervention, un PDF « Bon d'intervention » récapitule
-- les travaux réalisés, l'équipement, les photos et les signatures
-- (opérateur / client), pour être remis ou envoyé par email au client.
-- Chaque PDF généré est archivé (bucket privé `bons`) avec un snapshot
-- des données et, s'il a été envoyé, le destinataire et la date.
--
-- Réversibilité (jamais exécuté automatiquement) :
--   drop table public.intervention_bons;
--   delete from storage.buckets where id = 'bons';

create table if not exists public.intervention_bons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  storage_path text not null,
  donnees jsonb not null default '{}'::jsonb,
  envoye_le timestamptz,
  destinataire text,
  created_at timestamptz not null default now()
);

create index if not exists intervention_bons_intervention_idx
  on public.intervention_bons (intervention_id, created_at desc);

alter table public.intervention_bons enable row level security;

create policy "intervention_bons_owner_select"
  on public.intervention_bons for select
  using (auth.uid() = user_id);

create policy "intervention_bons_owner_insert"
  on public.intervention_bons for insert
  with check (auth.uid() = user_id);

create policy "intervention_bons_owner_update"
  on public.intervention_bons for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "intervention_bons_owner_delete"
  on public.intervention_bons for delete
  using (auth.uid() = user_id);

-- Bucket privé, chemins préfixés {user_id}/… comme les autres.
insert into storage.buckets (id, name, public)
  values ('bons', 'bons', false)
  on conflict (id) do nothing;

create policy "storage_bons_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'bons'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_bons_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'bons'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_bons_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'bons'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
