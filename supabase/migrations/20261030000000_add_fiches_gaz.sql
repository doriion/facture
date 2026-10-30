-- =============================================================================
-- Page « Fiches gaz » : fiche fluides frigorigènes simplifiée, saisie sur
-- le téléphone en une seule page (client, natures d'intervention,
-- équipement, fluide et charge, manipulations, contrôle d'étanchéité,
-- fuites, observations, photos, bon de réception, signatures), avec
-- génération du CERFA 15497 et du bon, envoi au client, et signature du
-- détenteur en ligne par lien.
--
-- Une fiche gaz EST une intervention (table interventions) : agenda,
-- photos, signatures, CERFA et bons existants s'appliquent tels quels.
-- Migration STRICTEMENT ADDITIVE : colonnes nullables ou avec défaut,
-- aucune donnée existante modifiée, RLS inchangée.
-- =============================================================================

alter table public.interventions
  add column if not exists est_fiche_gaz boolean not null default false,
  add column if not exists fiche_numero text,
  add column if not exists natures_cerfa text[] not null default '{}',
  add column if not exists equipement_type text
    check (equipement_type is null or equipement_type in ('climatisation', 'pompe_a_chaleur')),
  add column if not exists equipement_repere text,
  add column if not exists fluide_manipulations jsonb not null default '[]'::jsonb,
  add column if not exists detection_permanente boolean not null default false,
  add column if not exists fuite_reparation text
    check (fuite_reparation is null or fuite_reparation in ('realisee', 'a_faire')),
  add column if not exists bon_devis_numero text,
  add column if not exists bon_objet text,
  add column if not exists bon_reserves text
    check (bon_reserves is null or bon_reserves in ('sans', 'avec')),
  add column if not exists bon_reserves_texte text,
  add column if not exists signature_token text,
  add column if not exists signature_token_expires_at timestamptz,
  add column if not exists signature_demandee_le timestamptz;

create unique index if not exists idx_interventions_signature_token
  on public.interventions (signature_token) where signature_token is not null;
create index if not exists idx_interventions_fiche_gaz
  on public.interventions (user_id, date_intervention desc) where est_fiche_gaz;

comment on column public.interventions.est_fiche_gaz is
  'Saisie depuis la page « Fiches gaz » (fiche fluides frigorigènes simplifiée).';
comment on column public.interventions.fiche_numero is
  'N° de fiche CERFA, attribué à la première sauvegarde (AAMMJJ, suffixe -N le même jour).';
comment on column public.interventions.natures_cerfa is
  'Cadre 4 du CERFA 15497 : natures d''intervention cochées.';
comment on column public.interventions.fluide_manipulations is
  'Injections et récupérations de fluide : [{"type":"injection|recuperation","nature":"vierge|recycle|regenere|traitement|reutilisation","kg":0.5}].';
comment on column public.interventions.signature_token is
  'Jeton du lien public de signature du détenteur (/f/<jeton>).';
