-- Avoirs (notes de crédit) — additif.
--
-- Une facture émise ne se modifie pas et ne se supprime pas : elle se
-- corrige par un AVOIR, document numéroté dans sa propre séquence
-- (A-AAAA-NNNN), qui référence la facture d'origine et porte le montant
-- crédité (positif). Deux modes :
--   - imputation    : vient en déduction du reste dû de la facture d'origine
--                     (facture non ou partiellement payée) ;
--   - remboursement : la facture d'origine a été payée, le montant est à
--                     rembourser au client (le remboursement s'enregistre
--                     comme un « paiement » de l'avoir et vient en MOINS
--                     des recettes encaissées).
--
-- 1) Colonnes + contraintes élargies sur factures. Les CHECK existants
--    sont recréés avec une valeur de plus : aucune ligne existante n'est
--    touchée.
alter table public.factures
  add column if not exists mode_avoir text,
  add column if not exists motif_avoir text;

alter table public.factures drop constraint if exists factures_type_facture_check;
alter table public.factures add constraint factures_type_facture_check
  check (type_facture in ('normale', 'acompte', 'solde', 'avoir'));

alter table public.factures drop constraint if exists factures_mode_avoir_check;
alter table public.factures add constraint factures_mode_avoir_check
  check (mode_avoir is null or mode_avoir in ('imputation', 'remboursement'));

-- Un avoir référence toujours sa facture d'origine et a un mode ; les
-- autres types n'ont pas de mode d'avoir.
alter table public.factures drop constraint if exists factures_avoir_coherence_check;
alter table public.factures add constraint factures_avoir_coherence_check
  check (
    (type_facture = 'avoir' and facture_parent_id is not null and mode_avoir is not null)
    or (type_facture <> 'avoir' and mode_avoir is null)
  );

-- 2) Numérotation : séquence dédiée aux avoirs. La fonction
--    next_document_number (factures, devis, contrats) n'est PAS modifiée.
alter table public.numerotation drop constraint if exists numerotation_type_document_check;
alter table public.numerotation add constraint numerotation_type_document_check
  check (type_document in ('facture', 'devis', 'contrat', 'avoir'));

create or replace function public.next_avoir_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_annee int := extract(year from (now() at time zone 'Europe/Paris'))::int;
  v_numero int;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  insert into public.numerotation (user_id, annee, type_document, dernier_numero)
    values (v_user_id, v_annee, 'avoir', 1)
  on conflict (user_id, annee, type_document)
    do update set dernier_numero = numerotation.dernier_numero + 1,
                  updated_at = now()
  returning dernier_numero into v_numero;

  return 'A-' || v_annee::text || '-' || lpad(v_numero::text, 4, '0');
end;
$$;

grant execute on function public.next_avoir_number() to authenticated;

-- 3) Modes de paiement : l'application propose « carte » et
--    « lien_paiement » (lib/paiements-constants.ts) mais la contrainte de
--    la base ne connaissait que « cb » — l'enregistrement échouait.
--    Valeurs historiques conservées.
alter table public.paiements drop constraint if exists paiements_mode_check;
alter table public.paiements add constraint paiements_mode_check
  check (mode in ('virement', 'cheque', 'especes', 'cb', 'carte', 'lien_paiement', 'autre'));
