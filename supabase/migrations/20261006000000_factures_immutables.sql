-- =============================================================================
-- Immutabilité des documents émis, garantie EN BASE (l'application
-- l'assurait seule ; toute session SQL, script ou bug pouvait réécrire
-- un numéro ou supprimer une facture émise).
--
-- Additif : deux triggers, aucune donnée réécrite, aucune policy modifiée.
--   - le numéro d'une facture ou d'un devis ne change jamais ;
--   - une facture qui n'est plus en brouillon ne se supprime pas (même
--     annulée : c'est elle qui justifie le trou dans la séquence,
--     art. 242 nonies A annexe II CGI).
-- La numérotation elle-même (fonctions next_*_number, table
-- numerotation) n'est pas touchée.
--
-- ROLLBACK (manuel) :
--   drop trigger if exists trg_factures_numero_immutable on public.factures;
--   drop trigger if exists trg_devis_numero_immutable on public.devis;
--   drop trigger if exists trg_factures_delete_protegee on public.factures;
--   drop function if exists public.refuser_changement_numero();
--   drop function if exists public.refuser_suppression_facture_emise();
-- =============================================================================

create or replace function public.refuser_changement_numero()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.numero is distinct from old.numero then
    raise exception 'Le numéro d''un document émis ne change pas (% → %).', old.numero, new.numero
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.refuser_suppression_facture_emise()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.statut <> 'brouillon' then
    raise exception 'La facture % (%) ne se supprime pas : elle a été émise. Annulez-la, elle justifie le trou de numérotation.', old.numero, old.statut
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_factures_numero_immutable on public.factures;
create trigger trg_factures_numero_immutable
  before update of numero on public.factures
  for each row execute function public.refuser_changement_numero();

drop trigger if exists trg_devis_numero_immutable on public.devis;
create trigger trg_devis_numero_immutable
  before update of numero on public.devis
  for each row execute function public.refuser_changement_numero();

drop trigger if exists trg_factures_delete_protegee on public.factures;
create trigger trg_factures_delete_protegee
  before delete on public.factures
  for each row execute function public.refuser_suppression_facture_emise();

revoke execute on function public.refuser_changement_numero() from anon;
revoke execute on function public.refuser_suppression_facture_emise() from anon;
