-- =============================================================================
-- Nouveau modèle de PDF pour les devis (v2) + champs qui l'alimentent.
--
-- Migration STRICTEMENT ADDITIVE : aucune colonne supprimée ou
-- renommée, aucune donnée réécrite, aucune policy modifiée.
--
-- POINT CLÉ — LES DEVIS DÉJÀ ÉMIS NE BOUGENT PAS.
-- Les PDF sont régénérés à chaque téléchargement : changer le modèle
-- changerait aussi l'apparence des devis déjà envoyés aux clients. Le
-- numéro de version du modèle est donc stocké PAR DEVIS, exactement
-- comme contrats.template_version :
--   - la colonne est ajoutée SANS valeur par défaut, donc toutes les
--     lignes existantes restent à NULL ;
--   - NULL est interprété par l'application comme « modèle v1 » : un
--     devis déjà émis se réimprime à l'identique ;
--   - le défaut n'est posé QU'APRÈS coup, si bien que seuls les devis
--     créés à partir de maintenant naissent en v2.
-- L'ordre des deux instructions est volontaire : avec
-- « add column ... default 2 », PostgreSQL remplirait les lignes
-- existantes avec 2 et casserait justement cette garantie.
-- =============================================================================

alter table public.devis
  add column if not exists pdf_template_version integer
    check (pdf_template_version is null or pdf_template_version between 1 and 2);

alter table public.devis
  alter column pdf_template_version set default 2;

comment on column public.devis.pdf_template_version is
  'Version du modèle PDF figée à la création. NULL = v1 (devis antérieurs, réimprimés à l''identique), 2 = modèle courant.';

-- Adresse du chantier, distincte de l'adresse de facturation du client
-- (bloc « ADRESSE DU CHANTIER » du nouveau modèle). Vide = le chantier
-- est à l'adresse du client, le bloc n'est alors pas imprimé.
alter table public.devis
  add column if not exists adresse_chantier text
    check (adresse_chantier is null or char_length(adresse_chantier) <= 500);

comment on column public.devis.adresse_chantier is
  'Adresse du chantier si elle diffère de celle du client. Vide = adresse client.';

-- Réglages par défaut de la section « CONDITIONS DE L'OFFRE » et de
-- l'acompte. Textes libres pour rester modifiables sans redéploiement.
alter table public.profil_entreprise
  add column if not exists acompte_pct_default numeric(5, 2) not null default 40
    check (acompte_pct_default >= 0 and acompte_pct_default <= 100),
  add column if not exists delai_intervention_default text,
  add column if not exists frais_deplacement_default text,
  add column if not exists gestion_dechets_default text;

comment on column public.profil_entreprise.acompte_pct_default is
  'Acompte proposé par défaut à la création d''un devis (40 %).';

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin ; destructif pour les
-- valeurs saisies dans les colonnes concernées) :
--
--   alter table public.devis
--     drop column if exists pdf_template_version,
--     drop column if exists adresse_chantier;
--   alter table public.profil_entreprise
--     drop column if exists acompte_pct_default,
--     drop column if exists delai_intervention_default,
--     drop column if exists frais_deplacement_default,
--     drop column if exists gestion_dechets_default;
-- =============================================================================
