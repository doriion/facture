-- Rattrapage : colonnes créées directement sur le projet, sans fichier
-- de migration (annulation traçable, factures d'acompte et de solde).
-- Reflète EXACTEMENT la production (relevé du 19/09/2026), chaque
-- étape gardée : sur la base existante, aucun effet. Additif.
alter table public.factures
  add column if not exists date_annulation date,
  add column if not exists motif_annulation text,
  add column if not exists type_facture text not null default 'normale',
  add column if not exists facture_parent_id uuid references public.factures(id) on delete set null,
  add column if not exists pourcentage_acompte numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'factures_type_facture_check') then
    alter table public.factures add constraint factures_type_facture_check
      check (type_facture in ('normale', 'acompte', 'solde'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'factures_pourcentage_acompte_check') then
    alter table public.factures add constraint factures_pourcentage_acompte_check
      check (pourcentage_acompte is null or (pourcentage_acompte > 0 and pourcentage_acompte <= 100));
  end if;
end $$;

create index if not exists idx_factures_parent
  on public.factures (facture_parent_id) where facture_parent_id is not null;
create index if not exists idx_factures_date_annulation
  on public.factures (user_id, date_annulation) where statut = 'annulee';

-- Un RDV iPhone ne peut être rattaché qu'à UNE facture : la contrainte
-- existante (facture_id, external_uid) autorisait un même RDV sur deux
-- factures (et l'agenda n'en gardait qu'un au hasard). Vérifié sans
-- doublon en production avant ajout.
create unique index if not exists facture_external_events_user_uid_key
  on public.facture_external_events (user_id, external_uid);

-- Politiques UPDATE : « with check » manquant, le user_id d'une ligne
-- pouvait être réécrit vers un autre compte. Mono-utilisateur
-- aujourd'hui, mais la garantie RLS doit être complète.
alter policy "taches_owner_update" on public.taches
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "contrats_owner_update" on public.contrats
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "interventions_series_owner_update" on public.interventions_series
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "push_abonnements_owner_update" on public.push_abonnements
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "external_events_importes_owner_update" on public.external_events_importes
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
