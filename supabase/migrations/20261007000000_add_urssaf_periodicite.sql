-- =============================================================================
-- Périodicité de la déclaration de chiffre d'affaires à l'URSSAF
-- (mensuelle ou trimestrielle, au choix de l'auto-entrepreneur) : sert au
-- rappel « déclaration à faire avant le … » du tableau de bord.
--
-- Migration STRICTEMENT ADDITIVE : une colonne avec valeur par défaut,
-- aucune ligne réécrite, aucune policy modifiée (RLS existante par user_id).
-- =============================================================================

alter table public.profil_entreprise
  add column if not exists urssaf_periodicite text not null default 'trimestrielle'
    check (urssaf_periodicite in ('mensuelle', 'trimestrielle'));
