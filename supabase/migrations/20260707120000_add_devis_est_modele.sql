-- Lot 3 : modèles de devis réutilisables.
--
-- Migration ADDITIVE uniquement : ajoute une colonne avec valeur par
-- défaut, aucune donnée existante modifiée, aucun impact sur les devis
-- ou factures déjà émis. Les devis existants restent est_modele = false
-- (défaut appliqué par le moteur, sans UPDATE).
--
-- Un modèle reste une ligne de la table devis : la RLS existante
-- (auth.uid() = user_id) s'applique telle quelle.

alter table public.devis
  add column if not exists est_modele boolean not null default false;

comment on column public.devis.est_modele is
  'Devis servant de modèle réutilisable — exclu des listes de devis, des stats du dashboard et des compteurs.';
