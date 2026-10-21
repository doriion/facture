-- =============================================================================
-- Visites d'entretien, suite pratique :
--   - horaires réels de l'artisan pour les créneaux proposés aux clients ;
--   - suivi des propositions (relance du client sans réponse, alerte à
--     l'artisan) et rappel de la veille au client.
-- Migration STRICTEMENT ADDITIVE : colonnes nullables ou avec défaut,
-- aucune donnée existante modifiée, RLS inchangée.
-- Rollback :
--   alter table public.profil_entreprise drop column horaires_visites;
--   alter table public.visites_propositions drop column relance_le, drop column artisan_prevenu_le;
--   alter table public.contrats_maintenance drop column rappel_veille_envoye_pour;
-- =============================================================================

alter table public.profil_entreprise
  add column if not exists horaires_visites jsonb not null default '{}'::jsonb;
comment on column public.profil_entreprise.horaires_visites is
  'Créneaux proposés aux clients pour les visites : jours travaillés et tranches matin / après-midi (lib/horaires-visites). {} = valeurs par défaut.';

alter table public.visites_propositions
  add column if not exists relance_le timestamptz,
  add column if not exists artisan_prevenu_le timestamptz;
comment on column public.visites_propositions.relance_le is
  'Relance envoyée au client sans réponse (une seule).';
comment on column public.visites_propositions.artisan_prevenu_le is
  'Artisan prévenu d''une proposition restée sans réponse (une seule fois).';

alter table public.contrats_maintenance
  add column if not exists rappel_veille_envoye_pour date;
comment on column public.contrats_maintenance.rappel_veille_envoye_pour is
  'Date de visite pour laquelle le rappel de la veille a été envoyé au client.';
