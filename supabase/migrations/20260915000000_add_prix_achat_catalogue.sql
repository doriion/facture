-- =============================================================================
-- Prix d'achat et fournisseur au CATALOGUE (produits_services).
--
-- Migration STRICTEMENT ADDITIVE. Même sémantique que sur les lignes de
-- devis et de factures (migration 20260910000000) :
--   - prix_achat_ttc : coût RÉEL payé au fournisseur, TVA comprise
--     (franchise en base : la TVA sur achats n'est pas récupérée, le
--     coût c'est donc le TTC). La marge se calcule directement
--     prix de vente − prix d'achat TTC, sans retraitement.
--   - fournisseur : libre (ex. Yukai, Artiplastic).
-- Une ligne ajoutée depuis le catalogue reprend ces deux valeurs, qui
-- restent modifiables au cas par cas sur le document.
--
-- CONFIDENTIALITÉ : ces colonnes ne doivent JAMAIS atteindre le client.
--   - RLS : produits_services est déjà en « owner for all »
--     (auth.uid() = user_id) et n'a AUCUNE policy anon — les nouvelles
--     colonnes héritent de cette protection, rien à ajouter ici.
--   - Côté application : aucune surface publique (app/c/**,
--     app/api/public/**) ne lit le catalogue, et le test garde-fou de
--     lib/pdf-payload.test.ts le vérifie à chaque exécution.
--   - Les exports destinés au client (PDF, lien de signature) passent
--     par des listes blanches qui ne contiennent pas ces champs.
--     Seuls l'export de marges et la sauvegarde complète — tous deux
--     PRIVÉS, pour vous — contiennent les coûts.
-- =============================================================================

alter table public.produits_services
  add column if not exists prix_achat_ttc numeric(10, 2)
    check (prix_achat_ttc is null or prix_achat_ttc >= 0),
  add column if not exists fournisseur text
    check (fournisseur is null or char_length(fournisseur) <= 120);

comment on column public.produits_services.prix_achat_ttc is
  'Coût d''achat unitaire TTC (privé — jamais exposé au client : RLS owner-only, aucune surface publique ne lit le catalogue).';
comment on column public.produits_services.fournisseur is
  'Fournisseur habituel (privé — jamais exposé au client).';

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin de revenir en arrière ;
-- destructif : les valeurs saisies seraient perdues) :
--
--   alter table public.produits_services
--     drop column if exists prix_achat_ttc,
--     drop column if exists fournisseur;
-- =============================================================================
