-- =============================================================================
-- Devis signé SUR PAPIER et renvoyé par le client (photo, scan, PDF) :
-- l'artisan le joint depuis la fiche ; le devis passe en « accepté » et
-- le document est archivé dans le bucket immuable `signatures`
-- (insert + select, jamais de suppression), comme la signature au doigt.
-- Migration STRICTEMENT ADDITIVE : deux colonnes nullables, aucune
-- donnée existante modifiée, RLS inchangée.
-- Rollback : alter table public.devis drop column retour_signe_url, drop column retour_signe_mime;
-- =============================================================================

alter table public.devis
  add column if not exists retour_signe_url text,
  add column if not exists retour_signe_mime text;
comment on column public.devis.retour_signe_url is
  'Devis signé sur papier reçu du client (photo ou PDF), archivé dans le bucket immuable signatures.';
comment on column public.devis.retour_signe_mime is
  'Type du fichier archivé (image/jpeg, image/png, image/webp, application/pdf).';
