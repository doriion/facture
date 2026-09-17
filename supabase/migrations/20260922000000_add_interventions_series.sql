-- =============================================================================
-- Lot évènements récurrents : série de rendez-vous (toutes les semaines,
-- toutes les 2 semaines, tous les mois, tous les ans, jusqu'à une date).
--
-- Migration STRICTEMENT ADDITIVE :
--   1) interventions_series : la règle de répétition (fréquence,
--      intervalle, du… au…), propriété de l'utilisateur (RLS owner-only)
--   2) interventions.serie_id : colonne NULLABLE, FK on delete set null.
--      Chaque occurrence reste une intervention ORDINAIRE (facturable,
--      photos, signatures, CERFA…) ; la série ne sert qu'à modifier ou
--      supprimer « ce rendez-vous et les suivants » d'un coup.
--
-- Aucune donnée existante n'est modifiée (serie_id vaut NULL partout).
-- Numérotation, factures, devis : non concernés.
-- Rollback :
--   alter table public.interventions drop column serie_id;
--   drop table public.interventions_series;
-- =============================================================================

create table if not exists public.interventions_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  frequence text not null
    check (frequence in ('hebdomadaire', 'mensuelle', 'annuelle')),
  -- Toutes les N semaines / N mois / N ans (2 = une semaine sur deux)
  intervalle integer not null default 1 check (intervalle between 1 and 12),
  date_debut date not null,
  date_fin date not null,
  created_at timestamptz not null default now(),
  constraint interventions_series_dates check (date_fin >= date_debut)
);

comment on table public.interventions_series is
  'Règle de répétition d''une série de rendez-vous ; chaque occurrence est une ligne ordinaire de interventions (serie_id).';

alter table public.interventions_series enable row level security;

create policy "interventions_series_owner_select"
  on public.interventions_series for select using (auth.uid() = user_id);
create policy "interventions_series_owner_insert"
  on public.interventions_series for insert with check (auth.uid() = user_id);
create policy "interventions_series_owner_update"
  on public.interventions_series for update using (auth.uid() = user_id);
create policy "interventions_series_owner_delete"
  on public.interventions_series for delete using (auth.uid() = user_id);

alter table public.interventions
  add column if not exists serie_id uuid
    references public.interventions_series (id) on delete set null;

create index if not exists interventions_serie_id_idx
  on public.interventions (serie_id);

comment on column public.interventions.serie_id is
  'Série de rendez-vous récurrents dont cette intervention est une occurrence (NULL = rendez-vous isolé).';
