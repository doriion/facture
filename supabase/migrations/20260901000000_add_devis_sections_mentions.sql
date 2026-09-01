-- =============================================================================
-- Lot devis irréprochables + suivi décennale.
--
-- Migration STRICTEMENT ADDITIVE :
--   1) type de ligne (titre de section) sur devis/factures — les lignes
--      existantes restent des lignes normales (défaut 'ligne'), rien
--      n'est converti
--   2) mentions devis travaux : acompte demandé + « signé au domicile »
--      (le droit de rétractation L221-18 s'affiche alors sur le PDF)
--   3) suivi de validité : décennale (échéance + activités couvertes)
--      et attestation fluides (échéance)
-- Aucune table supprimée/modifiée, aucune donnée existante altérée,
-- aucune policy touchée. Pas de nouvelle table (RLS existantes).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Titres de section dans les lignes
-- -----------------------------------------------------------------------------
alter table public.factures_lignes
  add column if not exists type text not null default 'ligne'
    check (type in ('ligne', 'titre'));

alter table public.devis_lignes
  add column if not exists type text not null default 'ligne'
    check (type in ('ligne', 'titre'));

comment on column public.devis_lignes.type is
  'ligne = prestation facturable ; titre = titre de section (sans quantité ni prix, sert aux sous-totaux du PDF).';

-- -----------------------------------------------------------------------------
-- 2) Mentions devis de travaux
--    (date_debut_travaux et duree_estimee_jours existent déjà)
-- -----------------------------------------------------------------------------
alter table public.devis
  add column if not exists acompte_pct numeric
    check (acompte_pct is null or (acompte_pct > 0 and acompte_pct <= 100)),
  add column if not exists acompte_montant numeric
    check (acompte_montant is null or acompte_montant >= 0),
  add column if not exists signe_a_domicile boolean not null default false;

comment on column public.devis.acompte_pct is
  'Acompte demandé à la commande, en %. Exclusif avec acompte_montant (le % prime s''il est renseigné).';
comment on column public.devis.signe_a_domicile is
  'Devis signé au domicile du client (contrat hors établissement) : le PDF ajoute la mention du droit de rétractation de 14 jours (art. L221-18 c. conso).';

-- -----------------------------------------------------------------------------
-- 3) Suivi de validité des attestations (profil)
-- -----------------------------------------------------------------------------
alter table public.profil_entreprise
  add column if not exists decennale_valide_jusquau date,
  add column if not exists decennale_activites text,
  add column if not exists fluides_valide_jusquau date;

comment on column public.profil_entreprise.decennale_valide_jusquau is
  'Fin de validité de l''attestation décennale — alerte dashboard 30 jours avant, rouge si dépassée.';
comment on column public.profil_entreprise.decennale_activites is
  'Activités couvertes par la décennale (texte libre, ex. « 5.1 Plomberie, 5.2 Génie climatique/PAC »).';
comment on column public.profil_entreprise.fluides_valide_jusquau is
  'Fin de validité de l''attestation de capacité fluides frigorigènes — même mécanique d''alerte.';
