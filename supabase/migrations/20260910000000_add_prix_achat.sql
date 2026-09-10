-- =============================================================================
-- Prix d'achat privé sur les lignes de devis et de factures.
--
-- Migration STRICTEMENT ADDITIVE :
--   - prix_achat_ttc_unitaire : coût RÉEL payé au fournisseur, TVA
--     comprise (franchise en base : la TVA sur achats n'est pas
--     récupérée, le coût c'est le TTC). La marge se calcule donc
--     directement prix de vente − prix d'achat TTC, sans retraitement.
--   - fournisseur : libre (ex. Yukai, Artiplastic).
--
-- CONFIDENTIALITÉ : ces colonnes ne doivent JAMAIS atteindre le client.
--   - RLS : les deux tables sont déjà en « owner for all »
--     (auth.uid() = user_id, policies *_lignes_owner_all du schéma
--     initial) et n'ont AUCUNE policy anon — les nouvelles colonnes
--     héritent de cette protection, rien à ajouter ici.
--   - Côté application : le rendu PDF passe par une liste blanche de
--     champs (lib/pdf-payload.ts) qui exclut ces colonnes, et un test
--     garde-fou interdit toute référence à ces colonnes dans les
--     surfaces publiques (app/api/public/**, app/c/**).
-- =============================================================================

alter table public.devis_lignes
  add column if not exists prix_achat_ttc_unitaire numeric(10, 2)
    check (prix_achat_ttc_unitaire is null or prix_achat_ttc_unitaire >= 0),
  add column if not exists fournisseur text
    check (fournisseur is null or char_length(fournisseur) <= 120);

alter table public.factures_lignes
  add column if not exists prix_achat_ttc_unitaire numeric(10, 2)
    check (prix_achat_ttc_unitaire is null or prix_achat_ttc_unitaire >= 0),
  add column if not exists fournisseur text
    check (fournisseur is null or char_length(fournisseur) <= 120);

comment on column public.devis_lignes.prix_achat_ttc_unitaire is
  'Coût d''achat unitaire TTC (privé — jamais exposé au client : PDF en liste blanche, RLS owner-only).';
comment on column public.factures_lignes.prix_achat_ttc_unitaire is
  'Coût d''achat unitaire TTC (privé — jamais exposé au client : PDF en liste blanche, RLS owner-only).';

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin de revenir en arrière ;
-- destructif : les valeurs saisies seraient perdues) :
--
--   alter table public.devis_lignes
--     drop column if exists prix_achat_ttc_unitaire,
--     drop column if exists fournisseur;
--   alter table public.factures_lignes
--     drop column if exists prix_achat_ttc_unitaire,
--     drop column if exists fournisseur;
-- =============================================================================
