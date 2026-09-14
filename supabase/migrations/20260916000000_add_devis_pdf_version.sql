-- =============================================================================
-- Version du modèle de PDF, figée par devis.
--
-- Migration STRICTEMENT ADDITIVE : une colonne, aucune donnée réécrite,
-- aucune policy modifiée.
--
-- POURQUOI. Les PDF ne sont pas stockés : ils sont régénérés à chaque
-- téléchargement. Changer le modèle changerait donc aussi l'apparence
-- des devis DÉJÀ envoyés aux clients. La version est donc stockée sur
-- chaque devis, comme contrats.template_version :
--   - colonne ajoutée SANS valeur par défaut → toutes les lignes
--     existantes restent à NULL ;
--   - NULL = « modèle historique » côté application : un devis déjà
--     émis se réimprime à l'identique, indéfiniment ;
--   - le défaut n'est posé QU'ENSUITE, donc seuls les devis créés à
--     partir de maintenant naissent avec le nouveau modèle.
--
-- L'ordre des deux instructions est volontaire : « add column ...
-- default 2 » remplirait les lignes existantes avec 2 et ferait
-- basculer les anciens devis dans le nouveau modèle.
-- =============================================================================

alter table public.devis
  add column if not exists pdf_template_version integer
    check (pdf_template_version is null or pdf_template_version between 1 and 2);

alter table public.devis
  alter column pdf_template_version set default 2;

comment on column public.devis.pdf_template_version is
  'Version du modèle PDF figée à la création. NULL = modèle historique (devis antérieurs, réimprimés à l''identique), 2 = modèle simple courant.';

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin ; les devis repassent
-- alors tous sur le modèle historique) :
--
--   alter table public.devis drop column if exists pdf_template_version;
-- =============================================================================
