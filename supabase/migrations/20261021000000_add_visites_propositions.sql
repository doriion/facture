-- =============================================================================
-- Propositions de visite d'entretien : l'artisan (ou le rappel automatique)
-- propose un créneau au client par e-mail ; le client confirme, choisit un
-- autre créneau libre de l'agenda, ou décline — depuis une page publique
-- accessible par jeton. Le choix crée le rendez-vous dans l'agenda.
--
-- Migration STRICTEMENT ADDITIVE : une table, RLS owner-only
-- (auth.uid() = user_id). La page publique passe par le service role
-- côté serveur, jamais par anon. Rollback : drop table public.visites_propositions;
-- =============================================================================

create table if not exists public.visites_propositions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contrat_id uuid not null references public.contrats_maintenance(id) on delete cascade,
  -- Jeton opaque du lien public (base64url, 32 octets).
  token text not null unique,
  origine text not null default 'manuel' check (origine in ('manuel', 'automatique')),
  date_proposee date not null,
  heure_proposee time,
  -- Autres créneaux libres proposés : [{ "date": "2026-10-15", "debut": "08:00", "fin": "12:00" }, …]
  creneaux jsonb not null default '[]'::jsonb,
  statut text not null default 'envoyee'
    check (statut in ('envoyee', 'confirmee', 'replanifiee', 'refusee', 'annulee')),
  choix_date date,
  choix_debut time,
  choix_fin time,
  message_client text,
  intervention_id uuid references public.interventions(id) on delete set null,
  envoyee_le timestamptz not null default now(),
  expire_le timestamptz not null,
  repondu_le timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_visites_propositions_contrat
  on public.visites_propositions (user_id, contrat_id, envoyee_le desc);

alter table public.visites_propositions enable row level security;

create policy "visites_propositions_owner_select"
  on public.visites_propositions for select using (auth.uid() = user_id);
create policy "visites_propositions_owner_insert"
  on public.visites_propositions for insert with check (auth.uid() = user_id);
create policy "visites_propositions_owner_update"
  on public.visites_propositions for update using (auth.uid() = user_id);
create policy "visites_propositions_owner_delete"
  on public.visites_propositions for delete using (auth.uid() = user_id);

comment on table public.visites_propositions is
  'Créneaux de visite d''entretien proposés au client par e-mail ; sa réponse (page publique par jeton) crée le rendez-vous dans l''agenda.';
