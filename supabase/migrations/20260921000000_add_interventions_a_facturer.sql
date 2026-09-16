-- « Rien à facturer » : tout ce qui est sur le planning n'est pas à
-- facturer (aller chercher des outils, déplacement, perso…). Une
-- intervention cochée « rien à facturer » sort des compteurs et des
-- listes « à facturer » et ne réclame jamais de facture. Elle peut
-- être remise « à facturer » à tout moment.
--
-- Migration ADDITIVE : une colonne booléenne avec défaut TRUE, donc
-- toutes les interventions existantes restent « à facturer » (aucune
-- donnée modifiée). RLS, FK et index inchangés.
-- Rollback : alter table public.interventions drop column a_facturer;

alter table public.interventions
  add column if not exists a_facturer boolean not null default true;

comment on column public.interventions.a_facturer is
  'FALSE = rien à facturer (déplacement, outils, perso) : exclue des compteurs et listes « à facturer ».';
