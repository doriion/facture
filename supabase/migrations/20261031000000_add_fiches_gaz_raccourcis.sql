-- Fiches gaz : raccourcis de saisie.
-- ADDITIF uniquement : aucune table, policy ou colonne existante n'est modifiée.
--
-- - profil_entreprise.signature_url : signature de l'opérateur mémorisée
--   (bucket privé `signatures`, dossier {user_id}/profil/…), appliquée
--   d'un tap sur chaque fiche.
-- - interventions : nature d'intervention « autre » (cadre 4 du CERFA) et
--   déchets de fluide (cadres 12-13 : n° BSFF, contenants, destination).

alter table public.profil_entreprise
  add column if not exists signature_url text;

alter table public.interventions
  add column if not exists nature_autre text,
  add column if not exists dechets_bsff text,
  add column if not exists dechets_contenants text,
  add column if not exists dechets_destination text;
