-- Contrôle complet du 24/09/2026 : avis de sécurité et de performance
-- Supabase. Additif, aucune donnée touchée.
--
-- 1) Droits d'exécution : next_avoir_number (créée le 24/09) était
--    exécutable par `anon` (défaut PostgreSQL : PUBLIC), et
--    ensure_calendar_token aussi. Les deux exigent auth.uid() et
--    échouaient de toute façon sans session ; on ferme la porte.
--    calendar_events_for_token reste ouverte à anon : c'est le flux ICS
--    public par jeton (voulu).
revoke execute on function public.next_avoir_number() from public, anon;
revoke execute on function public.ensure_calendar_token(boolean) from anon;

-- 2) Clé étrangère sans index (intervention_bons.user_id).
create index if not exists intervention_bons_user_idx
  on public.intervention_bons (user_id);

-- 3) Politiques RLS : `auth.uid()` était réévalué à chaque ligne ;
--    `(select auth.uid())` est calculé une fois par requête (avis
--    auth_rls_initplan, 55 politiques). Même règle, même résultat :
--    propriétaire = auth.uid(). Statements générés depuis pg_policies.
alter policy agenda_couleurs_evenements_owner_all on public.agenda_couleurs_evenements using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy bareme_entretien_postes_owner_all on public.bareme_entretien_postes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy bareme_entretien_reglages_owner_all on public.bareme_entretien_reglages using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy bareme_entretien_zones_owner_all on public.bareme_entretien_zones using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy clients_owner_all on public.clients using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy contrats_owner_delete on public.contrats using ((select auth.uid()) = user_id);
alter policy contrats_owner_insert on public.contrats with check ((select auth.uid()) = user_id);
alter policy contrats_owner_select on public.contrats using ((select auth.uid()) = user_id);
alter policy contrats_owner_update on public.contrats using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy contrats_owner_all on public.contrats_maintenance using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy declarations_urssaf_owner_all on public.declarations_urssaf using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy devis_owner_all on public.devis using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy devis_lignes_owner_all on public.devis_lignes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy external_events_importes_owner_delete on public.external_events_importes using ((select auth.uid()) = user_id);
alter policy external_events_importes_owner_insert on public.external_events_importes with check ((select auth.uid()) = user_id);
alter policy external_events_importes_owner_select on public.external_events_importes using ((select auth.uid()) = user_id);
alter policy external_events_importes_owner_update on public.external_events_importes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy facture_external_events_owner_all on public.facture_external_events using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy factures_owner_all on public.factures using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy factures_lignes_owner_all on public.factures_lignes using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy intervention_bons_owner_delete on public.intervention_bons using ((select auth.uid()) = user_id);
alter policy intervention_bons_owner_insert on public.intervention_bons with check ((select auth.uid()) = user_id);
alter policy intervention_bons_owner_select on public.intervention_bons using ((select auth.uid()) = user_id);
alter policy intervention_bons_owner_update on public.intervention_bons using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy intervention_cerfa_owner_delete on public.intervention_cerfa using ((select auth.uid()) = user_id);
alter policy intervention_cerfa_owner_insert on public.intervention_cerfa with check ((select auth.uid()) = user_id);
alter policy intervention_cerfa_owner_select on public.intervention_cerfa using ((select auth.uid()) = user_id);
alter policy intervention_photos_owner_all on public.intervention_photos using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy intervention_signatures_owner_insert on public.intervention_signatures with check ((select auth.uid()) = user_id);
alter policy intervention_signatures_owner_select on public.intervention_signatures using ((select auth.uid()) = user_id);
alter policy interventions_owner_all on public.interventions using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy interventions_series_owner_delete on public.interventions_series using ((select auth.uid()) = user_id);
alter policy interventions_series_owner_insert on public.interventions_series with check ((select auth.uid()) = user_id);
alter policy interventions_series_owner_select on public.interventions_series using ((select auth.uid()) = user_id);
alter policy interventions_series_owner_update on public.interventions_series using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy numerotation_owner_all on public.numerotation using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy paiements_owner_all on public.paiements using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy produits_owner_all on public.produits_services using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy profil_entreprise_owner_all on public.profil_entreprise using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy push_abonnements_owner_delete on public.push_abonnements using ((select auth.uid()) = user_id);
alter policy push_abonnements_owner_insert on public.push_abonnements with check ((select auth.uid()) = user_id);
alter policy push_abonnements_owner_select on public.push_abonnements using ((select auth.uid()) = user_id);
alter policy push_abonnements_owner_update on public.push_abonnements using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy relances_owner_all on public.relances using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy taches_owner_delete on public.taches using ((select auth.uid()) = user_id);
alter policy taches_owner_insert on public.taches with check ((select auth.uid()) = user_id);
alter policy taches_owner_select on public.taches using ((select auth.uid()) = user_id);
alter policy taches_owner_update on public.taches using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy taches_journal_owner_insert on public.taches_journal with check ((select auth.uid()) = user_id);
alter policy taches_journal_owner_select on public.taches_journal using ((select auth.uid()) = user_id);
alter policy taches_journal_owner_update on public.taches_journal using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy taches_photos_owner_delete on public.taches_photos using ((select auth.uid()) = user_id);
alter policy taches_photos_owner_insert on public.taches_photos with check ((select auth.uid()) = user_id);
alter policy taches_photos_owner_select on public.taches_photos using ((select auth.uid()) = user_id);
alter policy taux_cotisations_owner_all on public.taux_cotisations using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
