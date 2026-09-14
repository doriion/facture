-- =============================================================================
-- Avis de reconduction « loi Chatel » : interrupteur d'automatisation.
--
-- Migration STRICTEMENT ADDITIVE : une colonne booléenne sur le profil,
-- livrée à FALSE — aucun email ne peut partir tant que l'utilisateur ne
-- l'active pas lui-même, et le mode simulation
-- (automatisations_simulation, TRUE par défaut) s'applique en plus.
--
-- Pourquoi cet avis. Pour un client CONSOMMATEUR, les articles L. 215-1
-- et suivants du code de la consommation imposent d'informer le client
-- de sa faculté de ne pas reconduire, au plus tôt trois mois et au plus
-- tard un mois avant l'échéance annuelle. À défaut, le client peut
-- résilier gratuitement à tout moment après la reconduction et se faire
-- rembourser les sommes versées. C'est exactement ce que rappelle
-- l'article 7 du contrat type (lib/contrats/template-v1.ts, figé).
--
-- Anti-doublon : la colonne contrats.rappel_chatel_envoye_pour existe
-- déjà (migration 20260904000000_add_contrats.sql) et mémorise
-- l'échéance déjà avisée. Rien à ajouter ici.
-- =============================================================================

alter table public.profil_entreprise
  add column if not exists auto_chatel_active boolean not null default false;

comment on column public.profil_entreprise.auto_chatel_active is
  'Envoi automatique de l''avis de reconduction loi Chatel (art. L. 215-1 c. conso.) aux clients particuliers. Désactivé par défaut.';

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin) :
--
--   alter table public.profil_entreprise
--     drop column if exists auto_chatel_active;
-- =============================================================================
