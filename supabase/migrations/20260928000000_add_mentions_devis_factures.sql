-- Mentions légales (audit du 18/09/2026). Additif uniquement.
--
-- 1) devis.mode_conclusion : le droit de rétractation (L221-18) vaut pour
--    un contrat conclu HORS ÉTABLISSEMENT (chez le client) comme À
--    DISTANCE (accepté par email / lien) ; le seul booléen
--    signe_a_domicile ne couvrait que le premier cas. La colonne
--    historique reste et est maintenue en cohérence par l'application.
-- 2) adresse_chantier sur devis et factures : lieu d'exécution des
--    travaux, mention obligatoire du devis de travaux quand il diffère
--    de l'adresse du client.
-- 3) factures.devis_id : la facture issue d'un devis peut le citer
--    (« suite au devis n° … du … ») — le lien n'existait que dans l'autre
--    sens (devis.facture_id).
alter table public.devis
  add column if not exists mode_conclusion text not null default 'etablissement'
    check (mode_conclusion in ('etablissement', 'hors_etablissement', 'distance')),
  add column if not exists adresse_chantier text;

-- Cohérence avec l'historique : un devis déjà marqué « signé au domicile »
-- est un contrat conclu hors établissement.
update public.devis set mode_conclusion = 'hors_etablissement'
  where signe_a_domicile = true and mode_conclusion = 'etablissement';

alter table public.factures
  add column if not exists adresse_chantier text,
  add column if not exists devis_id uuid references public.devis(id) on delete set null;

create index if not exists idx_factures_devis_id on public.factures (devis_id);

-- Renseigne le lien pour les factures déjà converties depuis un devis.
update public.factures f set devis_id = d.id
  from public.devis d
  where d.facture_id = f.id and f.devis_id is null;
