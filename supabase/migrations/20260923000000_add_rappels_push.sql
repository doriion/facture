-- =============================================================================
-- Lot rappels push : notification sur le téléphone avant chaque rendez-vous.
--
-- Migration STRICTEMENT ADDITIVE :
--   1) push_abonnements : un abonnement Web Push par appareil (endpoint +
--      clés), propriété de l'utilisateur (RLS owner-only)
--   2) profil_entreprise : interrupteur auto_rappels_push_active (OFF par
--      défaut) + délai rappels_push_delai_minutes (30 min par défaut)
--   3) interventions.rappel_push_envoye_le : horodatage du rappel envoyé
--      (idempotence : jamais deux rappels pour le même rendez-vous)
--   4) extensions pg_cron + pg_net : le déclencheur « toutes les 5 min »
--      qui appelle /api/cron/rappels-push (le plan Vercel Hobby ne
--      permet pas de cron plus fréquent que quotidien). La planification
--      elle-même (cron.schedule avec le secret) est faite hors dépôt,
--      au déploiement — le secret ne doit pas figurer ici.
--
-- Aucune donnée existante n'est modifiée. Rollback :
--   select cron.unschedule('rappels-push');
--   alter table public.interventions drop column rappel_push_envoye_le;
--   alter table public.profil_entreprise
--     drop column auto_rappels_push_active, drop column rappels_push_delai_minutes;
--   drop table public.push_abonnements;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Abonnements Web Push (un par appareil)
-- -----------------------------------------------------------------------------
create table if not exists public.push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Pour reconnaître l'appareil dans les réglages (« iPhone », « Chrome »)
  appareil text,
  created_at timestamptz not null default now(),
  derniere_utilisation timestamptz
);

create index if not exists push_abonnements_user_idx
  on public.push_abonnements (user_id);

alter table public.push_abonnements enable row level security;

create policy "push_abonnements_owner_select"
  on public.push_abonnements for select using (auth.uid() = user_id);
create policy "push_abonnements_owner_insert"
  on public.push_abonnements for insert with check (auth.uid() = user_id);
create policy "push_abonnements_owner_update"
  on public.push_abonnements for update using (auth.uid() = user_id);
create policy "push_abonnements_owner_delete"
  on public.push_abonnements for delete using (auth.uid() = user_id);

comment on table public.push_abonnements is
  'Abonnements Web Push (un par appareil) pour les rappels de rendez-vous.';

-- -----------------------------------------------------------------------------
-- 2) Réglages sur le profil — OFF par défaut
-- -----------------------------------------------------------------------------
alter table public.profil_entreprise
  add column if not exists auto_rappels_push_active boolean not null default false,
  add column if not exists rappels_push_delai_minutes integer not null default 30
    check (rappels_push_delai_minutes between 5 and 1440);

-- -----------------------------------------------------------------------------
-- 3) Idempotence : un seul rappel par rendez-vous
-- -----------------------------------------------------------------------------
alter table public.interventions
  add column if not exists rappel_push_envoye_le timestamptz;

comment on column public.interventions.rappel_push_envoye_le is
  'Rappel push envoyé à cet instant (NULL = pas encore) ; jamais deux rappels pour le même rendez-vous.';

-- -----------------------------------------------------------------------------
-- 4) Déclencheur toutes les 5 minutes (pg_cron + pg_net)
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
grant usage on schema cron to postgres;
