-- =============================================================================
-- Lot 6 : déclaration URSSAF outillée + documents historisés + cotisations.
--
-- Migration ADDITIVE :
--   1) nature fiscale URSSAF sur les lignes (et le catalogue), défaut
--      bic_prestations — les fournitures posées dans le cadre d'une
--      prestation restent en prestations (pas de bascule BIC ventes)
--   2) table declarations_urssaf (historique des CA déclarés par période)
--   3) snapshot émetteur figé sur factures/devis (SIRET historisé)
--   4) table taux_cotisations (barème daté, bascule ACRE)
-- Aucune suppression, aucune modification de données existantes autre
-- que les backfills documentés ci-dessous.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Nature fiscale URSSAF (les 3 cases du formulaire de déclaration)
--    Backfill implicite : les lignes existantes reçoivent le défaut
--    bic_prestations — correct pour une activité de prestations BTP.
-- -----------------------------------------------------------------------------
alter table public.factures_lignes
  add column if not exists nature_fiscale text not null default 'bic_prestations'
    check (nature_fiscale in ('bic_prestations', 'bic_ventes', 'bnc'));

alter table public.devis_lignes
  add column if not exists nature_fiscale text not null default 'bic_prestations'
    check (nature_fiscale in ('bic_prestations', 'bic_ventes', 'bnc'));

alter table public.produits_services
  add column if not exists nature_fiscale text not null default 'bic_prestations'
    check (nature_fiscale in ('bic_prestations', 'bic_ventes', 'bnc'));

comment on column public.factures_lignes.nature_fiscale is
  'Case URSSAF de la ligne : bic_prestations (défaut BTP), bic_ventes (revente sans pose), bnc. Les fournitures posées restent en prestations.';

-- -----------------------------------------------------------------------------
-- 2) Historique des déclarations URSSAF
--    Une ligne = une période déclarée sur autoentrepreneur.urssaf.fr.
--    Sert à repérer un écart si une facture/paiement bouge après coup.
-- -----------------------------------------------------------------------------
create table if not exists public.declarations_urssaf (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  periode_label text not null,
  periode_start date not null,
  periode_end date not null,
  -- Montant total déclaré et sa ventilation par case au moment de la
  -- déclaration : {"bic_prestations": 1234.5, "bic_ventes": 0, "bnc": 0}
  montant_declare numeric not null,
  ventilation jsonb not null default '{}'::jsonb,
  declare_le date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, periode_start, periode_end)
);

alter table public.declarations_urssaf enable row level security;

create policy "declarations_urssaf_owner_all"
  on public.declarations_urssaf for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3) Émetteur figé (SIRET historisé)
--    Un document émis conserve les mentions de l'émetteur au moment de
--    l'émission (raison sociale, adresse, SIRET, assurance…) : on fige,
--    on ne recalcule pas rétroactivement après un déménagement/changement
--    de SIRET. NULL tant que le document est en brouillon (= profil courant).
-- -----------------------------------------------------------------------------
alter table public.factures
  add column if not exists emetteur jsonb;
alter table public.devis
  add column if not exists emetteur jsonb;

-- Coordonnées de l'assureur décennale (art. 22-2 de la loi 96-603 :
-- la mention sur devis/factures doit inclure les COORDONNÉES de
-- l'assureur, pas seulement son nom).
alter table public.profil_entreprise
  add column if not exists assureur_decennale_adresse text;

comment on column public.factures.emetteur is
  'Snapshot des mentions émetteur au moment de l''émission (partiel de profil_entreprise). NULL = brouillon, le PDF utilise le profil courant.';

-- Backfill : les documents DÉJÀ émis (non brouillon) sont figés avec le
-- profil actuel — le meilleur état connu avant le changement de SIRET à
-- venir. À faire AVANT la formalité INPI.
update public.factures f
set emetteur = (
  select jsonb_strip_nulls(jsonb_build_object(
    'nom', p.nom, 'prenom', p.prenom, 'nom_commercial', p.nom_commercial,
    'adresse_ligne1', p.adresse_ligne1, 'adresse_ligne2', p.adresse_ligne2,
    'code_postal', p.code_postal, 'ville', p.ville, 'pays', p.pays,
    'siret', p.siret, 'siren', p.siren, 'code_ape', p.code_ape,
    'email_pro', p.email_pro, 'telephone', p.telephone,
    'site_web', p.site_web,
    'num_assurance_decennale', p.num_assurance_decennale,
    'assureur_decennale', p.assureur_decennale,
    'assureur_decennale_adresse', p.assureur_decennale_adresse,
    'zone_couverture_decennale', p.zone_couverture_decennale,
    'num_rm', p.num_rm, 'num_rge_qualipac', p.num_rge_qualipac,
    'num_attestation_fluides_frigo', p.num_attestation_fluides_frigo
  ))
  from public.profil_entreprise p
  where p.user_id = f.user_id
)
where f.emetteur is null and f.statut <> 'brouillon';

update public.devis d
set emetteur = (
  select jsonb_strip_nulls(jsonb_build_object(
    'nom', p.nom, 'prenom', p.prenom, 'nom_commercial', p.nom_commercial,
    'adresse_ligne1', p.adresse_ligne1, 'adresse_ligne2', p.adresse_ligne2,
    'code_postal', p.code_postal, 'ville', p.ville, 'pays', p.pays,
    'siret', p.siret, 'siren', p.siren, 'code_ape', p.code_ape,
    'email_pro', p.email_pro, 'telephone', p.telephone,
    'site_web', p.site_web,
    'num_assurance_decennale', p.num_assurance_decennale,
    'assureur_decennale', p.assureur_decennale,
    'assureur_decennale_adresse', p.assureur_decennale_adresse,
    'zone_couverture_decennale', p.zone_couverture_decennale,
    'num_rm', p.num_rm, 'num_rge_qualipac', p.num_rge_qualipac,
    'num_attestation_fluides_frigo', p.num_attestation_fluides_frigo
  ))
  from public.profil_entreprise p
  where p.user_id = d.user_id
)
where d.emetteur is null and d.statut <> 'brouillon' and d.est_modele = false;

-- -----------------------------------------------------------------------------
-- 4) Barème de cotisations daté (paramétrable, pas en dur dans le code)
--    Une ligne = un jeu de taux applicable à partir de date_debut.
--    Taux en % de l'encaissé : social (10,6 % ACRE / 21,2 % plein pour
--    les prestations BIC artisan), CFP (0,3 %), versement libératoire
--    (1,7 %). L'UI Paramètres crée les lignes par défaut au premier accès.
-- -----------------------------------------------------------------------------
create table if not exists public.taux_cotisations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date_debut date not null,
  libelle text not null,
  taux_social numeric not null check (taux_social >= 0 and taux_social <= 100),
  taux_cfp numeric not null default 0 check (taux_cfp >= 0 and taux_cfp <= 100),
  taux_vl numeric not null default 0 check (taux_vl >= 0 and taux_vl <= 100),
  created_at timestamptz not null default now(),
  unique (user_id, date_debut)
);

alter table public.taux_cotisations enable row level security;

create policy "taux_cotisations_owner_all"
  on public.taux_cotisations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
