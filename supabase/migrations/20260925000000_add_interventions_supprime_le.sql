-- =============================================================================
-- Lot « Annuler la suppression » : corbeille des interventions.
--
-- Migration STRICTEMENT ADDITIVE : une colonne `supprime_le` (NULL = en
-- service). Supprimer une intervention depuis l'app la met à la corbeille
-- (horodatage) au lieu de l'effacer ; elle disparaît de l'agenda, des
-- listes et des compteurs, et se restaure d'un clic. L'effacement réel
-- n'a lieu que sur « Supprimer définitivement » (mêmes garde-fous
-- qu'avant : signatures et CERFA à conserver).
--
-- Aucune donnée existante modifiée (supprime_le vaut NULL partout).
-- Rollback : alter table public.interventions drop column supprime_le;
-- =============================================================================

alter table public.interventions
  add column if not exists supprime_le timestamptz;

create index if not exists interventions_corbeille_idx
  on public.interventions (user_id, supprime_le)
  where supprime_le is not null;

comment on column public.interventions.supprime_le is
  'Mise à la corbeille à cet instant (NULL = en service). Restaurable ; effacement réel seulement sur demande explicite.';

-- -----------------------------------------------------------------------------
-- Export iCal (abonnement iPhone) : la corbeille n'est pas exportée.
-- Même définition qu'avant (20260511180000), avec un filtre en plus sur
-- les interventions ; les autres sources sont inchangées.
-- -----------------------------------------------------------------------------
create or replace function public.calendar_events_for_token(p_token text)
returns table (
  kind text,
  ev_id uuid,
  date_start date,
  date_end date,
  heure_debut time,
  heure_fin time,
  title text,
  description text,
  client_nom text,
  statut text,
  numero text,
  type_activite text,
  facture_emise boolean
)
language sql
security definer
set search_path = public
stable
as $$
  with target_user as (
    select user_id
    from public.profil_entreprise
    where calendar_token = p_token
      and p_token is not null
      and length(p_token) >= 16
    limit 1
  )
  select
    'intervention'::text as kind,
    i.id as ev_id,
    i.date_intervention as date_start,
    coalesce(i.date_fin, i.date_intervention) as date_end,
    i.heure_debut,
    i.heure_fin,
    coalesce(nullif(i.description, ''), i.type, 'Intervention') as title,
    i.description,
    c.nom as client_nom,
    null::text as statut,
    null::text as numero,
    i.type as type_activite,
    (i.facture_id is not null) as facture_emise
  from public.interventions i
  left join public.clients c on c.id = i.client_id
  where i.user_id = (select user_id from target_user)
    and i.supprime_le is null

  union all

  select
    'facture_prestation'::text,
    f.id,
    f.date_prestation,
    coalesce(f.date_prestation_fin, f.date_prestation),
    null::time, null::time,
    'Facture ' || f.numero,
    null::text,
    c.nom,
    f.statut,
    f.numero,
    f.type_activite,
    null::boolean
  from public.factures f
  left join public.clients c on c.id = f.client_id
  where f.user_id = (select user_id from target_user)
    and f.date_prestation is not null

  union all

  select
    'devis_planifie'::text,
    d.id,
    d.date_debut_travaux,
    case
      when d.duree_estimee_jours is not null and d.duree_estimee_jours > 1
        then d.date_debut_travaux + (d.duree_estimee_jours - 1)
      else d.date_debut_travaux
    end,
    null::time, null::time,
    'Devis ' || d.numero,
    null::text,
    c.nom,
    d.statut,
    d.numero,
    d.type_activite,
    null::boolean
  from public.devis d
  left join public.clients c on c.id = d.client_id
  where d.user_id = (select user_id from target_user)
    and d.date_debut_travaux is not null

  union all

  select
    'visite_maintenance'::text,
    m.id,
    m.prochaine_visite,
    m.prochaine_visite,
    null::time, null::time,
    coalesce(nullif(m.intitule, ''), 'Visite maintenance'),
    null::text,
    c.nom,
    m.statut,
    null::text,
    null::text,
    null::boolean
  from public.contrats_maintenance m
  left join public.clients c on c.id = m.client_id
  where m.user_id = (select user_id from target_user)
    and m.prochaine_visite is not null
    and m.statut = 'actif';
$$;
