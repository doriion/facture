-- =============================================================================
-- Remplacement TRANSACTIONNEL des lignes d'un devis ou d'une facture.
--
-- Migration STRICTEMENT ADDITIVE : création d'une fonction, aucune
-- table, colonne, donnée ni policy modifiée.
--
-- PROBLÈME RÉSOLU. L'édition d'un document remplace ses lignes en deux
-- requêtes séparées depuis l'application : DELETE puis INSERT. Chaque
-- requête a sa propre transaction : si l'INSERT échoue (réseau coupé,
-- contrainte violée, session expirée entre les deux), le DELETE est
-- déjà validé et le document se retrouve SANS AUCUNE LIGNE, avec un
-- total_ht qui ne correspond plus à rien. Les deux opérations sont ici
-- réunies dans une seule fonction, donc une seule transaction : tout
-- passe, ou rien ne change.
--
-- SÉCURITÉ. `security definer` est nécessaire pour que le verrou
-- `for update` porte sur la ligne du document. La fonction vérifie
-- elle-même la propriété :
--   - auth.uid() doit être renseigné (jamais appelable par anon) ;
--   - le document doit appartenir à auth.uid(), sinon « Accès refusé » ;
--   - les lignes insérées portent TOUJOURS user_id = auth.uid(), jamais
--     une valeur fournie par l'appelant.
-- `search_path` est figé à public (pas de détournement par un schéma
-- temporaire), l'exécution est révoquée à public et anon, et accordée
-- au seul rôle authenticated. La RLS owner-only des tables de lignes
-- reste en place et inchangée pour tous les autres accès.
--
-- CONFIDENTIALITÉ. prix_achat_ttc_unitaire et fournisseur transitent
-- par cette fonction comme aujourd'hui par l'INSERT : ce sont des
-- données du propriétaire, écrites par le propriétaire. Rien n'est
-- exposé au client (le rendu PDF passe par sa liste blanche).
-- =============================================================================

create or replace function public.remplacer_lignes_document(
  p_type text,
  p_document_id uuid,
  p_lignes jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_proprietaire uuid;
  v_nb integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié' using errcode = '28000';
  end if;

  if p_type not in ('devis', 'facture') then
    raise exception 'Type de document inconnu : %', p_type using errcode = '22023';
  end if;

  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' then
    raise exception 'Lignes invalides (tableau attendu)' using errcode = '22023';
  end if;

  -- Verrou de la ligne du document : deux enregistrements simultanés du
  -- même document s'exécutent l'un après l'autre, jamais entrelacés.
  if p_type = 'devis' then
    select user_id into v_proprietaire
      from public.devis where id = p_document_id for update;
  else
    select user_id into v_proprietaire
      from public.factures where id = p_document_id for update;
  end if;

  if v_proprietaire is null then
    raise exception 'Document introuvable' using errcode = 'P0002';
  end if;
  if v_proprietaire <> v_user_id then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  if p_type = 'devis' then
    delete from public.devis_lignes where devis_id = p_document_id;

    insert into public.devis_lignes (
      user_id, devis_id, ordre, designation, nature_fiscale, type,
      quantite, prix_unitaire_ht, prix_achat_ttc_unitaire, fournisseur,
      total_ht
    )
    select
      v_user_id,
      p_document_id,
      (l->>'ordre')::integer,
      l->>'designation',
      coalesce(nullif(l->>'nature_fiscale', ''), 'bic_prestations'),
      coalesce(nullif(l->>'type', ''), 'ligne'),
      (l->>'quantite')::numeric,
      (l->>'prix_unitaire_ht')::numeric,
      nullif(l->>'prix_achat_ttc_unitaire', '')::numeric,
      nullif(l->>'fournisseur', ''),
      (l->>'total_ht')::numeric
    from jsonb_array_elements(p_lignes) as l;
  else
    delete from public.factures_lignes where facture_id = p_document_id;

    insert into public.factures_lignes (
      user_id, facture_id, ordre, designation, nature_fiscale, type,
      quantite, prix_unitaire_ht, prix_achat_ttc_unitaire, fournisseur,
      total_ht
    )
    select
      v_user_id,
      p_document_id,
      (l->>'ordre')::integer,
      l->>'designation',
      coalesce(nullif(l->>'nature_fiscale', ''), 'bic_prestations'),
      coalesce(nullif(l->>'type', ''), 'ligne'),
      (l->>'quantite')::numeric,
      (l->>'prix_unitaire_ht')::numeric,
      nullif(l->>'prix_achat_ttc_unitaire', '')::numeric,
      nullif(l->>'fournisseur', ''),
      (l->>'total_ht')::numeric
    from jsonb_array_elements(p_lignes) as l;
  end if;

  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;

comment on function public.remplacer_lignes_document(text, uuid, jsonb) is
  'Remplace en UNE transaction les lignes d''un devis ou d''une facture appartenant à auth.uid(). Renvoie le nombre de lignes insérées.';

revoke all on function public.remplacer_lignes_document(text, uuid, jsonb) from public;
revoke all on function public.remplacer_lignes_document(text, uuid, jsonb) from anon;
grant execute on function public.remplacer_lignes_document(text, uuid, jsonb) to authenticated;

-- =============================================================================
-- ROLLBACK (à exécuter manuellement si besoin ; l'application retombe
-- alors sur le DELETE + INSERT en deux requêtes, qui reste en place
-- comme repli automatique si la fonction est absente) :
--
--   drop function if exists public.remplacer_lignes_document(text, uuid, jsonb);
-- =============================================================================
