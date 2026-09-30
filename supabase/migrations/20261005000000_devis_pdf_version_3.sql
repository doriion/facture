-- =============================================================================
-- Modèle de devis version 3 : le modèle simple + délai d'exécution et
-- conditions imprimés quand ils sont saisis (mentions attendues d'un
-- devis de travaux, art. L111-1 c. conso.).
--
-- Additif : la contrainte est ÉLARGIE (1..3), le défaut passe à 3 pour
-- les devis créés à partir de maintenant. Aucune ligne réécrite : les
-- devis existants gardent NULL (historique) ou 2 (simple) et se
-- réimpriment à l'identique.
-- =============================================================================

alter table public.devis
  drop constraint if exists devis_pdf_template_version_check;

alter table public.devis
  add constraint devis_pdf_template_version_check
    check (pdf_template_version is null or pdf_template_version between 1 and 3);

alter table public.devis
  alter column pdf_template_version set default 3;

comment on column public.devis.pdf_template_version is
  'Version du modèle PDF figée à la création. NULL = modèle historique, 2 = modèle simple, 3 = modèle simple + délai d''exécution et conditions.';
