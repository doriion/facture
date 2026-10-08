-- =============================================================================
-- Échéancier des visites : la date de la prochaine visite se DÉCIDE avec
-- le client (plus de date imposée à la mise en service du contrat), puis
-- se confirme par e-mail. Trois colonnes pour porter l'heure convenue et
-- la trace de la confirmation envoyée.
--
-- Migration STRICTEMENT ADDITIVE : colonnes nullables, aucune donnée
-- existante modifiée, RLS inchangée (owner-only, auth.uid() = user_id).
-- Rollback : alter table public.contrats_maintenance
--   drop column prochaine_visite_heure,
--   drop column confirmation_envoyee_pour,
--   drop column confirmation_envoyee_le;
-- =============================================================================

alter table public.contrats_maintenance
  add column if not exists prochaine_visite_heure time,
  add column if not exists confirmation_envoyee_pour date,
  add column if not exists confirmation_envoyee_le timestamptz;

comment on column public.contrats_maintenance.prochaine_visite_heure is
  'Heure convenue avec le client pour la prochaine visite (NULL = dans la journée).';
comment on column public.contrats_maintenance.confirmation_envoyee_pour is
  'Date de visite (prochaine_visite) pour laquelle un e-mail de confirmation a été envoyé au client.';
comment on column public.contrats_maintenance.confirmation_envoyee_le is
  'Horodatage de l''envoi de cette confirmation.';
