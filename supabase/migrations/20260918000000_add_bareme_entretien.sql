-- =============================================================================
-- Barème d'entretien paramétrable (calculateur intégré aux devis et aux
-- contrats d'entretien).
--
-- Migration STRICTEMENT ADDITIVE : trois nouvelles tables, aucune table
-- existante touchée, aucune donnée réécrite. Chaque table est visible
-- de son seul propriétaire (RLS auth.uid() = user_id). Les valeurs par
-- défaut (barème d'origine) sont insérées par l'application au premier
-- accès de l'utilisateur, jamais par cette migration.
--
-- FRANCHISE EN BASE DE TVA : tous les montants stockés sont NETS. Aucun
-- taux de TVA n'existe dans ce schéma.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Postes du barème : un équipement (split, CTA, PAC, VMC, VRV, unité
--    intérieure, filtre…) avec son prix unitaire DÉGRESSIF par tranche
--    de quantité — tranches = [{"a_partir_de": 1, "prix": 189},
--    {"a_partir_de": 2, "prix": 146}, {"a_partir_de": 6, "prix": 105}].
-- -----------------------------------------------------------------------------
create table if not exists public.bareme_entretien_postes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 60),
  groupe text not null check (groupe in ('split', 'cta', 'pac', 'vmc', 'vrv')),
  libelle text not null check (char_length(libelle) between 1 and 120),
  unite text not null default 'unité' check (char_length(unite) between 1 and 30),
  tranches jsonb not null default '[]'::jsonb,
  ordre integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

alter table public.bareme_entretien_postes enable row level security;

create policy "bareme_entretien_postes_owner_all"
  on public.bareme_entretien_postes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.bareme_entretien_postes is
  'Barème d''entretien : prix unitaire NET dégressif par tranche de quantité (montants nets, franchise en base de TVA).';

-- -----------------------------------------------------------------------------
-- 2) Zones de déplacement : forfait = distance × tarif au km + péage
--    + temps de route × taux horaire (tarif et taux dans la table 3).
-- -----------------------------------------------------------------------------
create table if not exists public.bareme_entretien_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 60),
  libelle text not null check (char_length(libelle) between 1 and 120),
  distance_km numeric(8, 1) not null default 0 check (distance_km >= 0),
  peage numeric(8, 2) not null default 0 check (peage >= 0),
  temps_route_h numeric(5, 2) not null default 0 check (temps_route_h >= 0),
  ordre integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

alter table public.bareme_entretien_zones enable row level security;

create policy "bareme_entretien_zones_owner_all"
  on public.bareme_entretien_zones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.bareme_entretien_zones is
  'Zones de déplacement du barème d''entretien : distance A/R, péage, temps de route (forfait calculé par l''application).';

-- -----------------------------------------------------------------------------
-- 3) Réglages globaux du déplacement (une ligne par utilisateur).
-- -----------------------------------------------------------------------------
create table if not exists public.bareme_entretien_reglages (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tarif_km numeric(6, 2) not null default 0.60 check (tarif_km >= 0),
  taux_horaire numeric(8, 2) not null default 25 check (taux_horaire >= 0),
  updated_at timestamptz not null default now()
);

alter table public.bareme_entretien_reglages enable row level security;

create policy "bareme_entretien_reglages_owner_all"
  on public.bareme_entretien_reglages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.bareme_entretien_reglages is
  'Réglages du déplacement (tarif au km, taux horaire) du barème d''entretien.';

-- =============================================================================
-- ROLLBACK (manuel, si besoin) :
--   drop table if exists public.bareme_entretien_reglages;
--   drop table if exists public.bareme_entretien_zones;
--   drop table if exists public.bareme_entretien_postes;
-- =============================================================================
