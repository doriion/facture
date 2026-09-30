-- 1) Bucket `sauvegardes` : politique UPDATE manquante. « Sauvegarder
--    maintenant » relancé le même jour fait un upsert (même nom de
--    fichier) : sans UPDATE, la RLS refusait la deuxième sauvegarde du
--    jour. Owner-only, même règle que select/insert/delete.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'storage_sauvegardes_owner_update'
  ) then
    create policy "storage_sauvegardes_owner_update"
      on storage.objects for update
      using (
        bucket_id = 'sauvegardes'
        and (select auth.uid())::text = (storage.foldername(name))[1]
      )
      with check (
        bucket_id = 'sauvegardes'
        and (select auth.uid())::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- 2) Rattrapage : colonnes et réglages créés directement sur le projet
--    sans fichier de migration (migrations « add_agenda_couleurs »,
--    « add_external_calendar_url », « update_default_penalites_retard_b2b »,
--    « harden_functions » présentes en base seulement). Un projet vierge
--    reconstruit depuis le dépôt n'avait pas ces colonnes : la
--    restauration documentée échouait. Reflète EXACTEMENT la production
--    (relevé du 30/09/2026), chaque étape gardée : aucun effet sur la
--    base existante. Additif.
alter table public.profil_entreprise
  add column if not exists agenda_couleurs jsonb not null
    default '{"devis": "violet", "facture": "blue", "maintenance": "cyan", "intervention_facturee": "emerald", "intervention_a_facturer": "amber"}'::jsonb,
  add column if not exists external_calendar_url text;

alter table public.profil_entreprise
  alter column penalites_retard_text
  set default 'En cas de retard de paiement, application de pénalités au taux de 3 fois le taux d''intérêt légal, ainsi qu''une indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce).';

-- search_path figé (avis « function search path mutable »)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
