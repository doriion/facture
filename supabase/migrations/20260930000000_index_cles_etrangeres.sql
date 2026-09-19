-- Index sur les clés étrangères sans index (conseiller de performance
-- Supabase, 19/09/2026) : jointures et suppressions en cascade plus
-- rapides. Additif, sans effet sur les données.
create index if not exists idx_contrats_maintenance_id on public.contrats (maintenance_id);
create index if not exists idx_devis_facture_id on public.devis (facture_id);
create index if not exists idx_devis_lignes_user_id on public.devis_lignes (user_id);
create index if not exists idx_external_events_importes_intervention on public.external_events_importes (intervention_id);
create index if not exists idx_factures_lignes_user_id on public.factures_lignes (user_id);
create index if not exists idx_intervention_cerfa_user_id on public.intervention_cerfa (user_id);
create index if not exists idx_intervention_photos_user_id on public.intervention_photos (user_id);
create index if not exists idx_intervention_signatures_user_id on public.intervention_signatures (user_id);
create index if not exists idx_interventions_facture_id on public.interventions (facture_id);
create index if not exists idx_interventions_series_user_id on public.interventions_series (user_id);
create index if not exists idx_taches_client_id on public.taches (client_id);
create index if not exists idx_taches_devis_id on public.taches (devis_id);
create index if not exists idx_taches_facture_id on public.taches (facture_id);
create index if not exists idx_taches_intervention_id on public.taches (intervention_id);
create index if not exists idx_taches_photos_user_id on public.taches_photos (user_id);
