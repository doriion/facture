-- =============================================================================
-- Réglage assujetti_tva (défaut false : franchise en base, art. 293 B).
--
-- Migration STRICTEMENT ADDITIVE. Pilote l'AFFICHAGE des documents :
--   - false (cas actuel) : pas de mention HT/TTC (« P.U. », « TOTAL »,
--     « NET À PAYER »), pas de ligne TVA dans les totaux ; la mention
--     « TVA non applicable, art. 293 B du CGI » reste en pied.
--   - true (jour d'un dépassement des seuils) : libellés HT conservés.
--     Le moteur TVA complet (taux/montants par ligne) reste à
--     construire dans un lot dédié — cette colonne réserve la place.
--
-- Le flag est FIGÉ dans le snapshot émetteur des documents à
-- l'émission (devis/factures : `emetteur`, contrats : `prestataire`,
-- cf. lib/emetteur.ts et lib/contrats/rendu.ts) : basculer le réglage
-- ne change JAMAIS l'apparence d'un document déjà émis ou signé.
-- Documents antérieurs sans le champ dans leur snapshot : traités
-- comme false (le cas de tous les documents existants).
-- =============================================================================

alter table public.profil_entreprise
  add column if not exists assujetti_tva boolean not null default false;

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin) :
--
--   alter table public.profil_entreprise
--     drop column if exists assujetti_tva;
-- =============================================================================
