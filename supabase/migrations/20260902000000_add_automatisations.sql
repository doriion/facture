-- =============================================================================
-- Lot automatisations & fiabilité.
--
-- Migration STRICTEMENT ADDITIVE :
--   1) taches_journal : trace de chaque exécution de tâche planifiée
--      (idempotence : une ligne par tâche et par jour, contrainte unique)
--   2) interrupteurs d'automatisation sur profil_entreprise — TOUT est
--      livré DÉSACTIVÉ sauf la sauvegarde (aucun envoi client), et le
--      mode SIMULATION est actif par défaut
--   3) factures.exclure_relances_auto (opt-out par facture)
--   4) contrats_maintenance.rappel_envoye_pour (traçage du rappel envoyé
--      pour une échéance donnée — le plus simple, pas de table en plus)
--   5) bucket privé `sauvegardes` + policies par dossier {user_id}/…
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Journal des tâches planifiées
-- -----------------------------------------------------------------------------
create table if not exists public.taches_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tache text not null,
  date_execution date not null default current_date,
  statut text not null check (statut in ('succes', 'erreur', 'ignoree')),
  details text,
  -- true = mode simulation : rien n'a été réellement envoyé
  dry_run boolean not null default false,
  created_at timestamptz not null default now(),
  -- Idempotence : une exécution par tâche et par jour. Un ré-appel du
  -- cron le même jour voit la ligne et ne refait rien.
  unique (user_id, tache, date_execution)
);

alter table public.taches_journal enable row level security;

create policy "taches_journal_owner_select"
  on public.taches_journal for select
  using (auth.uid() = user_id);

create policy "taches_journal_owner_insert"
  on public.taches_journal for insert
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2) Interrupteurs d'automatisation (sur le profil — une ligne par user)
-- -----------------------------------------------------------------------------
alter table public.profil_entreprise
  -- Sauvegarde mensuelle : SEULE automatisation active par défaut
  -- (aucun envoi client, aucun risque)
  add column if not exists auto_sauvegarde_active boolean not null default true,
  -- Relances d'impayés automatiques : OFF par défaut
  add column if not exists auto_relances_active boolean not null default false,
  add column if not exists relances_delai_jours integer not null default 15
    check (relances_delai_jours between 1 and 90),
  -- Rappels d'entretien : OFF par défaut
  add column if not exists auto_rappels_active boolean not null default false,
  add column if not exists rappels_fenetre_jours integer not null default 30
    check (rappels_fenetre_jours between 1 and 120),
  -- Mode simulation GLOBAL : journalise ce qui AURAIT été envoyé sans
  -- rien envoyer aux clients. ACTIF par défaut — à désactiver
  -- explicitement une fois le comportement validé.
  add column if not exists automatisations_simulation boolean not null default true;

-- -----------------------------------------------------------------------------
-- 3) Opt-out de relance automatique par facture
-- -----------------------------------------------------------------------------
alter table public.factures
  add column if not exists exclure_relances_auto boolean not null default false;

comment on column public.factures.exclure_relances_auto is
  'Facture exclue des relances automatiques (client à relancer de vive voix). Les relances manuelles restent possibles.';

-- -----------------------------------------------------------------------------
-- 4) Traçage du rappel d'entretien
-- -----------------------------------------------------------------------------
alter table public.contrats_maintenance
  add column if not exists rappel_envoye_pour date;

comment on column public.contrats_maintenance.rappel_envoye_pour is
  'Échéance (prochaine_visite) pour laquelle un rappel client a déjà été envoyé — évite les doublons ; se réarme quand la visite est replanifiée.';

-- -----------------------------------------------------------------------------
-- 5) Bucket privé des sauvegardes (rotation applicative : 12 conservées)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('sauvegardes', 'sauvegardes', false)
  on conflict (id) do nothing;

create policy "storage_sauvegardes_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'sauvegardes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_sauvegardes_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'sauvegardes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_sauvegardes_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'sauvegardes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
