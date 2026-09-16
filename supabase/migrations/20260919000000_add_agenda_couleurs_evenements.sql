-- =============================================================================
-- Couleur propre à un évènement de l'agenda (prime sur la couleur de
-- son type).
--
-- Migration STRICTEMENT ADDITIVE : une nouvelle table, aucune table
-- existante touchée. Les couleurs PAR TYPE restent dans la colonne
-- existante profil_entreprise.agenda_couleurs (JSONB) : aucune
-- modification de schéma pour elles.
--
-- La clé d'évènement est « kind:id » (ex. « intervention:<uuid> »,
-- « facture_prestation:<uuid> », « external:<uid iCal> ») : la table ne
-- référence aucune autre table, pour couvrir aussi les RDV iPhone qui
-- n'existent qu'en lecture. Une couleur orpheline (évènement supprimé)
-- est simplement inerte.
-- =============================================================================

create table if not exists public.agenda_couleurs_evenements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  evenement_cle text not null check (char_length(evenement_cle) between 3 and 300),
  couleur text not null check (couleur ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, evenement_cle)
);

alter table public.agenda_couleurs_evenements enable row level security;

create policy "agenda_couleurs_evenements_owner_all"
  on public.agenda_couleurs_evenements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.agenda_couleurs_evenements is
  'Couleur (#rrggbb) choisie pour un évènement précis de l''agenda, clé « kind:id » ; prime sur la couleur du type.';

-- =============================================================================
-- ROLLBACK (manuel, si besoin) :
--   drop table if exists public.agenda_couleurs_evenements;
-- =============================================================================
