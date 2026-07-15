-- =============================================================================
-- Lot 5 : traçabilité fluides frigorigènes complète (CERFA 15497*04,
-- signatures, archives PDF).
--
-- Migration ADDITIVE uniquement :
--   - colonnes NULLABLES sur interventions (aucune donnée existante touchée)
--   - 2 nouvelles tables avec RLS auth.uid() = user_id
--   - 2 nouveaux buckets Storage privés + policies par dossier {user_id}/…
-- Aucune modification des tables, policies ou buckets existants.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) interventions : compléments manipulation de fluide + contrôle d'étanchéité
--    (cadres 3, 5 et 10 du CERFA 15497*04)
-- -----------------------------------------------------------------------------
alter table public.interventions
  add column if not exists fluide_charge_totale_kg numeric,
  add column if not exists etancheite_controle boolean,
  add column if not exists etancheite_detecteur text,
  add column if not exists etancheite_detecteur_controle_le date,
  add column if not exists etancheite_fuite boolean,
  add column if not exists etancheite_fuite_localisation text,
  add column if not exists fluide_observations text;

comment on column public.interventions.fluide_charge_totale_kg is
  'Charge totale en fluide de l''équipement (kg) — sert au calcul t éq. CO2 (charge × PRG) et à la périodicité du contrôle d''étanchéité.';
comment on column public.interventions.etancheite_controle is
  'Contrôle d''étanchéité effectué lors de cette intervention.';
comment on column public.interventions.etancheite_detecteur is
  'Identification du détecteur manuel de fuite (n° de série ou repère) — cadre 5 du CERFA 15497.';
comment on column public.interventions.etancheite_detecteur_controle_le is
  'Date du dernier contrôle annuel du détecteur (seuil ≤ 5 g/an).';
comment on column public.interventions.etancheite_fuite is
  'Fuite constatée lors du contrôle (cadre 10 du CERFA 15497).';
comment on column public.interventions.etancheite_fuite_localisation is
  'Localisation de la fuite et état de la réparation.';
comment on column public.interventions.fluide_observations is
  'Observations de l''opérateur sur la manipulation de fluide (cadre 14 du CERFA 15497).';

-- -----------------------------------------------------------------------------
-- 2) Signatures d'intervention — IMMUABLES (valeur probante)
--    Volontairement AUCUNE policy update/delete : une signature enregistrée
--    est figée ; re-signer insère une nouvelle version datée.
-- -----------------------------------------------------------------------------
create table if not exists public.intervention_signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- ON DELETE RESTRICT : sans quoi supprimer l'intervention détruirait
  -- en cascade des signatures « immuables » (conservation 5 ans). La
  -- suppression d'une intervention signée est refusée par la base.
  intervention_id uuid not null references public.interventions (id) on delete restrict,
  role text not null check (role in ('operateur', 'detenteur')),
  signataire_nom text not null,
  signataire_qualite text,
  storage_path text not null,
  signe_le timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists intervention_signatures_intervention_idx
  on public.intervention_signatures (intervention_id);

alter table public.intervention_signatures enable row level security;

create policy "intervention_signatures_owner_select"
  on public.intervention_signatures for select
  using (auth.uid() = user_id);

create policy "intervention_signatures_owner_insert"
  on public.intervention_signatures for insert
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3) CERFA 15497 archivés (PDF dans Storage + snapshot des données)
--    delete autorisé : une archive régénérable reste gérable par son
--    propriétaire ; les signatures qu'elle référence restent immuables.
-- -----------------------------------------------------------------------------
create table if not exists public.intervention_cerfa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- RESTRICT également : le snapshot d'une fiche archivée n'est pas
  -- régénérable après suppression de l'intervention. Supprimer d'abord
  -- les fiches archivées (action delete dédiée), ensuite l'intervention.
  intervention_id uuid not null references public.interventions (id) on delete restrict,
  storage_path text not null,
  donnees jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists intervention_cerfa_intervention_idx
  on public.intervention_cerfa (intervention_id);

alter table public.intervention_cerfa enable row level security;

create policy "intervention_cerfa_owner_select"
  on public.intervention_cerfa for select
  using (auth.uid() = user_id);

create policy "intervention_cerfa_owner_insert"
  on public.intervention_cerfa for insert
  with check (auth.uid() = user_id);

create policy "intervention_cerfa_owner_delete"
  on public.intervention_cerfa for delete
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4) Buckets Storage privés (chemins préfixés {user_id}/…, comme l'existant)
--    'signatures' : select + insert uniquement (immuable, cohérent avec la table)
--    'cerfa'      : select + insert + delete
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('signatures', 'signatures', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('cerfa', 'cerfa', false)
  on conflict (id) do nothing;

create policy "storage_signatures_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'signatures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_signatures_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'signatures'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_cerfa_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'cerfa'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_cerfa_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'cerfa'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_cerfa_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'cerfa'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
