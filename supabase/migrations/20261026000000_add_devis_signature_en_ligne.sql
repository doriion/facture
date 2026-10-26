-- =============================================================================
-- Signature de devis EN LIGNE : le client reçoit dans l'e-mail d'envoi un
-- lien unique, lit le devis, signe au doigt depuis son téléphone ; le
-- devis passe en « accepté » avec le même circuit que la signature sur
-- place (bucket immuable `signatures`, colonne écrite une seule fois).
--
-- Migration STRICTEMENT ADDITIVE : colonnes nullables sur devis, aucune
-- donnée existante modifiée, RLS inchangée. La page publique passe par le
-- service role côté serveur, jamais par anon. Rollback :
--   alter table public.devis drop column access_token, drop column token_expires_at,
--     drop column signe_le, drop column signature_ip, drop column signature_user_agent,
--     drop column signature_origine;
-- =============================================================================

alter table public.devis
  add column if not exists access_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists signe_le timestamptz,
  add column if not exists signature_ip text,
  add column if not exists signature_user_agent text,
  add column if not exists signature_origine text
    check (signature_origine is null or signature_origine in ('sur_place', 'en_ligne'));

create unique index if not exists idx_devis_access_token
  on public.devis (access_token) where access_token is not null;

comment on column public.devis.access_token is
  'Jeton du lien public de signature (/d/<jeton>), posé à l''envoi par e-mail.';
comment on column public.devis.token_expires_at is
  'Fin de validité du lien de signature (fin de validité du devis).';
comment on column public.devis.signe_le is
  'Horodatage précis de la signature (date_signature reste la date du jour à Paris).';
comment on column public.devis.signature_ip is
  'Adresse IP du signataire (signature en ligne) — faisceau de preuves.';
comment on column public.devis.signature_user_agent is
  'Navigateur du signataire (signature en ligne) — faisceau de preuves.';
comment on column public.devis.signature_origine is
  'sur_place (dans l''application) ou en_ligne (page publique).';
