-- =============================================================================
-- Durée de validité des devis paramétrable (défaut 30 jours).
--
-- Migration STRICTEMENT ADDITIVE. Le formulaire de devis pré-remplit
-- « Valable jusqu'au » = date d'émission + cette durée (au lieu des
-- 90 jours codés en dur), surchargeable au cas par cas — le champ date
-- reste libre. Les devis existants ne bougent pas (leur date_validite
-- est stockée).
-- =============================================================================

alter table public.profil_entreprise
  add column if not exists duree_validite_devis_jours integer not null default 30
    check (duree_validite_devis_jours between 1 and 365);

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin) :
--
--   alter table public.profil_entreprise
--     drop column if exists duree_validite_devis_jours;
-- =============================================================================
