-- =============================================================================
-- Nom du signataire du « Bon pour accord » signé au doigt sur un devis
-- (imprimé sous la signature : « Bon pour accord — Jean Dupont, le … »).
--
-- Migration STRICTEMENT ADDITIVE : une colonne nullable, aucune ligne
-- réécrite, RLS existante par user_id inchangée.
-- =============================================================================

alter table public.devis add column if not exists signataire_nom text;
