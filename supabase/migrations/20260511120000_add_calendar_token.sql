-- =============================================================================
-- Flux iCal public : abonnement depuis l'agenda du téléphone (iOS/Android).
-- =============================================================================
-- 1. Token opaque par utilisateur, stocké dans profil_entreprise.
-- 2. Fonction SECURITY DEFINER pour exposer les évènements via le token,
--    sans nécessiter de session authentifiée (le flux iCal doit être
--    accessible sans header Authorization depuis l'app Calendrier d'iOS).
-- =============================================================================

alter table public.profil_entreprise
  add column if not exists calendar_token text unique;

-- Index permettant le lookup direct (la contrainte unique en fournit déjà un).

-- Fonction agrégeant tous les évènements de l'utilisateur identifié par le
-- token. SECURITY DEFINER pour franchir RLS, mais ne renvoie que les données
-- de l'utilisateur ayant ce token précis.
create or replace function public.calendar_events_for_token(p_token text)
returns table (
  kind text,
  ev_id uuid,
  date_start date,
  date_end date,
  title text,
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
    i.date_intervention as date_end,
    coalesce(nullif(i.description, ''), i.type, 'Intervention') as title,
    c.nom as client_nom,
    null::text as statut,
    null::text as numero,
    i.type as type_activite,
    (i.facture_id is not null) as facture_emise
  from public.interventions i
  left join public.clients c on c.id = i.client_id
  where i.user_id = (select user_id from target_user)

  union all

  select
    'facture_prestation'::text,
    f.id,
    f.date_prestation,
    coalesce(f.date_prestation_fin, f.date_prestation),
    'Facture ' || f.numero,
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
    'Devis ' || d.numero,
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
    coalesce(nullif(m.intitule, ''), 'Visite maintenance'),
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

revoke all on function public.calendar_events_for_token(text) from public;
grant execute on function public.calendar_events_for_token(text) to anon, authenticated;

-- Génère et stocke un token pour l'utilisateur courant si absent, sinon le
-- renvoie. Si p_force = true, regénère systématiquement.
create or replace function public.ensure_calendar_token(p_force boolean default false)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_token text;
begin
  if v_user is null then
    raise exception 'Non authentifié.';
  end if;

  if not p_force then
    select calendar_token into v_token
    from public.profil_entreprise
    where user_id = v_user;
    if v_token is not null then
      return v_token;
    end if;
  end if;

  -- Nouveau token : 32 octets base64url (≈ 43 chars, opaque)
  v_token := replace(replace(encode(extensions.gen_random_bytes(32), 'base64'), '+', '-'), '/', '_');
  v_token := rtrim(v_token, '=');

  insert into public.profil_entreprise (user_id, calendar_token)
  values (v_user, v_token)
  on conflict (user_id) do update set calendar_token = excluded.calendar_token;

  return v_token;
end;
$$;

revoke all on function public.ensure_calendar_token(boolean) from public;
grant execute on function public.ensure_calendar_token(boolean) to authenticated;
