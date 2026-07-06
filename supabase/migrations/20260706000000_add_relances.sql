-- =============================================================================
-- Traçage des relances de factures impayées
-- =============================================================================
-- Migration STRICTEMENT ADDITIVE : nouvelle table uniquement, aucune
-- modification des tables/policies/fonctions existantes.
--
-- Une ligne = un email de relance envoyé pour une facture. Permet
-- d'afficher « relancée le … » et d'éviter les doubles relances trop
-- rapprochées.

create table public.relances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  facture_id uuid not null references public.factures(id) on delete cascade,

  -- Date/heure d'envoi de la relance
  envoyee_le timestamptz not null default now(),
  -- Email destinataire au moment de l'envoi (le client peut changer d'adresse ensuite)
  destinataire text not null,
  -- Nombre de jours de retard au moment de l'envoi (snapshot pour l'historique)
  jours_retard integer not null,

  created_at timestamptz not null default now()
);

create index idx_relances_user_id on public.relances(user_id);
create index idx_relances_facture on public.relances(facture_id, envoyee_le desc);

alter table public.relances enable row level security;

create policy "relances_owner_all"
  on public.relances
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
