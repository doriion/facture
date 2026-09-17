-- =============================================================================
-- Lot « reprendre un RDV iPhone » : un évènement du calendrier externe
-- (abonnement iCal, lecture seule) devient une intervention NG Gestion à
-- part entière — déplaçable, modifiable, facturable — et sa copie iPhone
-- disparaît de l'agenda (pas de doublon).
--
-- Migration STRICTEMENT ADDITIVE : une table de correspondance
-- (clé iCal → intervention), RLS owner-only. Aucune donnée existante
-- modifiée. Rollback : drop table public.external_events_importes;
-- =============================================================================

create table if not exists public.external_events_importes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Mêmes clés que facture_external_events (lib/external-event-key.ts)
  external_uid text not null,
  fallback_key text,
  -- L'intervention créée ; si elle est supprimée, la copie iPhone reste
  -- masquée (NG Gestion est l'agenda de référence).
  intervention_id uuid references public.interventions (id) on delete set null,
  snapshot_title text,
  snapshot_date_start date,
  created_at timestamptz not null default now(),
  unique (user_id, external_uid)
);

create index if not exists external_events_importes_user_idx
  on public.external_events_importes (user_id, snapshot_date_start);

alter table public.external_events_importes enable row level security;

create policy "external_events_importes_owner_select"
  on public.external_events_importes for select using (auth.uid() = user_id);
create policy "external_events_importes_owner_insert"
  on public.external_events_importes for insert with check (auth.uid() = user_id);
create policy "external_events_importes_owner_update"
  on public.external_events_importes for update using (auth.uid() = user_id);
create policy "external_events_importes_owner_delete"
  on public.external_events_importes for delete using (auth.uid() = user_id);

comment on table public.external_events_importes is
  'RDV du calendrier externe (iPhone) repris comme interventions : la copie externe est masquée dans l''agenda.';
