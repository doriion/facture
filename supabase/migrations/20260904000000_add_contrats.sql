-- =============================================================================
-- Module « Contrats d'entretien » signés à distance.
--
-- Migration STRICTEMENT ADDITIVE :
--   1) table contrats : le contrat juridique (snapshots des deux parties,
--      équipements en JSONB, redevance, token d'accès public, preuve de
--      signature, PDF archivé) — distincte de contrats_maintenance qui
--      reste l'échéancier interne (visites / factures / rappels), avec
--      un lien optionnel entre les deux
--   2) numerotation : nouveau type 'contrat' (format « 2026-001 », comme
--      le docx de référence — pas de préfixe lettre, séquence sur 3
--      chiffres) : contrainte CHECK élargie + fonction remplacée (le
--      comportement facture/devis est inchangé)
--
-- RLS : la table n'est visible QUE par son propriétaire. L'accès du
-- client (lien public) passe exclusivement par des routes serveur qui
-- résolvent access_token avec le client service role — aucune policy
-- anon, ni sur la table, ni sur les buckets.
--
-- Buckets réutilisés (aucune création) :
--   - `signatures` (immuable : select + insert seulement) pour le PNG
--     de la signature client, chemin {user_id}/contrats/{contrat_id}/…
--   - `pdfs` (créé au schéma initial, jamais utilisé jusqu'ici) pour le
--     PDF signé archivé, chemin {user_id}/contrats/{contrat_id}/…
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Table contrats
-- -----------------------------------------------------------------------------
create table if not exists public.contrats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Attribué à l'envoi (jamais à la signature publique : la fonction de
  -- numérotation exige une session). Nullable tant que brouillon.
  numero text,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'envoye', 'signe', 'actif', 'resilie', 'expire')),

  -- Parties. client_id en restrict : on ne supprime pas un client qui a
  -- un contrat ; maintenance_id relie (optionnellement) le contrat signé
  -- à l'échéancier interne existant.
  client_id uuid not null references public.clients (id) on delete restrict,
  maintenance_id uuid references public.contrats_maintenance (id) on delete set null,

  -- Snapshots figés à l'envoi (le déménagement / changement de SIRET du
  -- prestataire ne doit jamais modifier un contrat émis). Le snapshot
  -- client est complété par le client lui-même à la signature.
  prestataire jsonb,
  client_snapshot jsonb,

  -- Site d'intervention (si différent de l'adresse du client)
  adresse_site text check (char_length(adresse_site) <= 500),
  contact_site text check (char_length(contact_site) <= 200),

  -- Équipements couverts (art. 1.2) — snapshot JSONB, même pattern que
  -- factures.equipement_info : [{type, marque_modele, num_serie,
  -- puissance_kw, fluide_charge}]
  equipements jsonb not null default '[]'::jsonb,

  -- Conditions financières (nets de taxe — franchise en base de TVA,
  -- AUCUN calcul de TVA dans ce module)
  redevance numeric(10, 2) not null default 0 check (redevance >= 0),
  remise numeric(10, 2) not null default 0 check (remise >= 0),
  plafond_pieces numeric(10, 2) not null default 0 check (plafond_pieces >= 0),

  -- Durée (art. 7) : échéance = anniversaire de la date d'effet,
  -- recalculée à chaque reconduction (sert aux rappels de phase 2)
  date_effet date,
  date_echeance date,

  qualite_client text not null default 'particulier'
    check (qualite_client in ('particulier', 'professionnel')),
  mode_conclusion text not null default 'distance'
    check (mode_conclusion in ('distance', 'hors_etablissement', 'presentiel')),
  -- Renseigné par le client à la signature
  occupant text check (occupant in ('proprietaire', 'locataire')),

  -- Le texte des articles vit dans le code (lib/contrats/template-v1.ts,
  -- v2.ts…) ; chaque contrat garde sa version pour régénérer à
  -- l'identique des années plus tard.
  template_version integer not null default 1,

  -- Lien public : token opaque (base64url 32 octets), 30 jours,
  -- révocable (mise à null), invalidé après signature.
  access_token text unique,
  token_expires_at timestamptz,

  -- Cycle de vie
  sent_at timestamptz,
  signed_at timestamptz,

  -- Faisceau de preuves de la signature électronique simple
  signataire_nom text check (char_length(signataire_nom) <= 200),
  signature_path text,        -- PNG dans le bucket immuable `signatures`
  signature_ip text,
  signature_user_agent text check (char_length(signature_user_agent) <= 500),
  pdf_path text,              -- PDF signé archivé dans le bucket `pdfs`
  pdf_sha256 text,            -- hash du PDF, repris sur la page de preuve

  -- Phase 2 (rappels) : juste la place, rien ne les remplit encore.
  -- Même pattern anti-doublon que contrats_maintenance.rappel_envoye_pour.
  rappel_chatel_envoye_pour date,
  rappel_visite_envoye_pour date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contrats_user_statut_idx
  on public.contrats (user_id, statut);
create index if not exists contrats_client_idx
  on public.contrats (client_id);

alter table public.contrats enable row level security;

create policy "contrats_owner_select"
  on public.contrats for select using (auth.uid() = user_id);
create policy "contrats_owner_insert"
  on public.contrats for insert with check (auth.uid() = user_id);
create policy "contrats_owner_update"
  on public.contrats for update using (auth.uid() = user_id);
create policy "contrats_owner_delete"
  on public.contrats for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2) Numérotation : type 'contrat', format « 2026-001 »
-- -----------------------------------------------------------------------------
alter table public.numerotation
  drop constraint if exists numerotation_type_document_check;
alter table public.numerotation
  add constraint numerotation_type_document_check
  check (type_document in ('facture', 'devis', 'contrat'));

-- Remplace la fonction : factures (F-2026-0001) et devis (D-2026-0042)
-- inchangés ; contrat → « 2026-001 » (séquence annuelle sur 3 chiffres,
-- sans préfixe, comme le modèle papier).
create or replace function public.next_document_number(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_annee int := extract(year from current_date)::int;
  v_numero int;
  v_prefix text;
begin
  if v_user_id is null then
    raise exception 'Authentification requise';
  end if;

  if p_type not in ('facture','devis','contrat') then
    raise exception 'Type de document invalide : %', p_type;
  end if;

  insert into public.numerotation (user_id, annee, type_document, dernier_numero)
    values (v_user_id, v_annee, p_type, 1)
  on conflict (user_id, annee, type_document)
    do update set dernier_numero = numerotation.dernier_numero + 1,
                  updated_at = now()
  returning dernier_numero into v_numero;

  if p_type = 'contrat' then
    return v_annee::text || '-' || lpad(v_numero::text, 3, '0');
  end if;

  v_prefix := case p_type when 'facture' then 'F' else 'D' end;
  return v_prefix || '-' || v_annee::text || '-' || lpad(v_numero::text, 4, '0');
end;
$$;
