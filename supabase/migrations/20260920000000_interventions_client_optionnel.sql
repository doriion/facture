-- Client OPTIONNEL sur les interventions : on peut poser un créneau dans
-- l'agenda avant de savoir pour qui (ou avant d'avoir créé le client),
-- puis rattacher le client plus tard depuis le détail de l'évènement ou
-- la fiche intervention.
--
-- Migration ADDITIVE : on relâche seulement la contrainte NOT NULL.
-- Aucune donnée existante n'est modifiée, la clé étrangère vers clients
-- (on delete restrict), l'index et la RLS (auth.uid() = user_id) restent
-- tels quels. Rollback (si aucune intervention sans client n'existe) :
--   alter table public.interventions alter column client_id set not null;
--
-- En aval : une intervention sans client reste affichée partout avec la
-- mention « Client à renseigner » ; la facturation exige toujours un
-- client (choisi dans le formulaire de facture, qui le reporte alors sur
-- l'intervention). La fonction calendar_events_for_token fait déjà un
-- LEFT JOIN sur clients : les flux ICS ne changent pas.

alter table public.interventions
  alter column client_id drop not null;

comment on column public.interventions.client_id is
  'Client rattaché — NULL tant qu''il n''est pas renseigné (créneau posé dans l''agenda avant de connaître le client). Obligatoire pour facturer.';
