-- La contrainte posée avec la signature en ligne n'admettait que
-- 'sur_place' et 'en_ligne' : joindre un devis signé sur papier échouait
-- (« violates check constraint devis_signature_origine_check »).
-- Migration ADDITIVE au sens des valeurs admises : la contrainte est
-- élargie à 'papier', aucune donnée modifiée. Rollback : remettre la
-- contrainte à ('sur_place', 'en_ligne') s'il n'existe aucune ligne 'papier'.

alter table public.devis drop constraint if exists devis_signature_origine_check;
alter table public.devis add constraint devis_signature_origine_check
  check (signature_origine is null or signature_origine in ('sur_place', 'en_ligne', 'papier'));
