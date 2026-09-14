-- =============================================================================
-- Nom des modèles de devis.
--
-- Migration STRICTEMENT ADDITIVE : une colonne nullable, sans valeur
-- par défaut, aucune donnée réécrite, aucune policy modifiée. Les
-- modèles existants (est_modele = true) restent à NULL et l'application
-- les affiche alors par leur numéro (« Modèle DEV-2026-0012 ») jusqu'à
-- ce qu'ils soient renommés.
--
-- Un modèle reste une ligne de la table devis : la RLS existante
-- (auth.uid() = user_id) s'applique telle quelle. Les devis normaux
-- n'utilisent pas cette colonne (NULL).
-- =============================================================================

alter table public.devis
  add column if not exists nom_modele text
    check (nom_modele is null or char_length(nom_modele) between 1 and 80);

comment on column public.devis.nom_modele is
  'Nom lisible du modèle de devis (est_modele = true), choisi et renommable par l''utilisateur. NULL sur les devis normaux et sur les modèles pas encore nommés.';

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin ; les modèles retombent
-- alors sur leur numéro) :
--
--   alter table public.devis drop column if exists nom_modele;
-- =============================================================================
