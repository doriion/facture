-- =============================================================================
-- Migration initiale : application facture/devis auto-entrepreneur BTP
-- =============================================================================
-- Tables : profil_entreprise, clients, produits_services, factures (+lignes),
--          devis (+lignes), paiements, interventions, contrats_maintenance,
--          numerotation
-- Sécurité : RLS strict mono-utilisateur (auth.uid() = user_id partout)
-- Storage : buckets privés `logos` et `pdfs`, accès limité au propriétaire
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper : trigger updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. PROFIL ENTREPRISE (1 ligne par utilisateur)
-- =============================================================================
create table public.profil_entreprise (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  -- Identité
  nom text,
  prenom text,
  nom_commercial text,

  -- Identifiants légaux
  siret text,
  siren text,
  code_ape text,
  num_rm text,                          -- Répertoire des Métiers (CMA)

  -- Adresse pro
  adresse_ligne1 text,
  adresse_ligne2 text,
  code_postal text,
  ville text,
  pays text default 'France',

  -- Contact
  email_pro text,
  telephone text,
  site_web text,

  -- BTP : assurance décennale (mention légale obligatoire)
  num_assurance_decennale text,
  assureur_decennale text,
  zone_couverture_decennale text default 'France métropolitaine',

  -- Clim/PAC : attestations spécifiques
  num_attestation_fluides_frigo text,   -- Catégorie I (F-Gas)
  num_rge_qualipac text,

  -- Banque
  iban text,
  bic text,
  banque_nom text,

  -- Médiateur de la consommation (obligatoire pour clients particuliers)
  mediateur_nom text,
  mediateur_site_web text,
  mediateur_adresse text,

  -- Logo
  logo_url text,

  -- Préférences par défaut
  conditions_paiement_default text default 'Paiement à 30 jours par virement bancaire.',
  penalites_retard_text text default 'En cas de retard de paiement, des pénalités calculées au taux d''intérêt légal en vigueur seront exigibles, ainsi qu''une indemnité forfaitaire de 40€ pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce).',
  escompte_text text default 'Pas d''escompte pour règlement anticipé.',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profil_entreprise_updated_at
  before update on public.profil_entreprise
  for each row execute function public.set_updated_at();

alter table public.profil_entreprise enable row level security;

create policy "profil_entreprise_owner_all"
  on public.profil_entreprise
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 2. CLIENTS
-- =============================================================================
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  nom text not null,
  type text not null default 'particulier'
    check (type in ('particulier','professionnel','syndic')),

  -- Si pro
  siret text,
  raison_sociale text,

  -- Adresse
  adresse_ligne1 text,
  adresse_ligne2 text,
  code_postal text,
  ville text,
  pays text default 'France',

  -- Contact
  email text,
  telephone text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_user_id on public.clients(user_id);
create index idx_clients_user_nom on public.clients(user_id, nom);

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "clients_owner_all"
  on public.clients
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 3. PRODUITS / SERVICES (catalogue de prestations réutilisables)
-- =============================================================================
create table public.produits_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  designation text not null,
  description text,
  prix_ht numeric(10, 2) not null check (prix_ht >= 0),
  unite text not null default 'unité',     -- 'heure', 'm²', 'kg', 'forfait'...

  categorie text not null default 'plomberie'
    check (categorie in ('plomberie','installation_clim','installation_pac','entretien','depannage','autre')),

  -- Pour information uniquement (en AE on n'applique pas de TVA)
  tva_taux_suggere numeric(5, 2),

  actif boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_produits_user_id on public.produits_services(user_id);
create index idx_produits_categorie on public.produits_services(user_id, categorie) where actif = true;

create trigger trg_produits_updated_at
  before update on public.produits_services
  for each row execute function public.set_updated_at();

alter table public.produits_services enable row level security;

create policy "produits_owner_all"
  on public.produits_services
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 4. NUMEROTATION (compteur chronologique annuel pour factures et devis)
-- =============================================================================
create table public.numerotation (
  user_id uuid not null references auth.users(id) on delete cascade,
  annee int not null,
  type_document text not null check (type_document in ('facture','devis')),
  dernier_numero int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, annee, type_document)
);

alter table public.numerotation enable row level security;

create policy "numerotation_owner_all"
  on public.numerotation
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fonction pour obtenir le prochain numéro et l'incrémenter atomiquement.
-- Renvoie "F-2026-0001" ou "D-2026-0042".
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

  if p_type not in ('facture','devis') then
    raise exception 'Type de document invalide : %', p_type;
  end if;

  v_prefix := case p_type when 'facture' then 'F' else 'D' end;

  insert into public.numerotation (user_id, annee, type_document, dernier_numero)
    values (v_user_id, v_annee, p_type, 1)
  on conflict (user_id, annee, type_document)
    do update set dernier_numero = numerotation.dernier_numero + 1,
                  updated_at = now()
  returning dernier_numero into v_numero;

  return v_prefix || '-' || v_annee::text || '-' || lpad(v_numero::text, 4, '0');
end;
$$;

grant execute on function public.next_document_number(text) to authenticated;

-- =============================================================================
-- 5. FACTURES
-- =============================================================================
create table public.factures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  numero text not null,                  -- F-AAAA-NNNN
  client_id uuid not null references public.clients(id) on delete restrict,

  date_emission date not null default current_date,
  date_echeance date not null,
  date_prestation date,

  statut text not null default 'brouillon'
    check (statut in ('brouillon','envoyee','payee','retard','annulee')),

  type_activite text not null default 'plomberie'
    check (type_activite in ('plomberie','installation_clim','installation_pac','entretien','depannage','autre')),

  total_ht numeric(10, 2) not null default 0,

  conditions_paiement text,
  notes text,

  -- JSON : aides financières (information client). Schéma souple :
  -- { "maprimerenov": 1500, "cee": 800, "eco_ptz": 0, "reste_a_charge": 4200 }
  aides_financieres jsonb not null default '{}'::jsonb,

  -- JSON : info équipement pour clim/PAC
  -- { "marque": "Daikin", "modele": "Altherma 3", "num_serie": "ABC123",
  --   "fluide_frigo_type": "R32", "fluide_frigo_kg": 1.4 }
  equipement_info jsonb not null default '{}'::jsonb,

  pdf_url text,
  email_envoye_le timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, numero)
);

create index idx_factures_user_emission on public.factures(user_id, date_emission desc);
create index idx_factures_user_statut on public.factures(user_id, statut);
create index idx_factures_client on public.factures(client_id);

create trigger trg_factures_updated_at
  before update on public.factures
  for each row execute function public.set_updated_at();

alter table public.factures enable row level security;

create policy "factures_owner_all"
  on public.factures
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5b. FACTURES_LIGNES
-- -----------------------------------------------------------------------------
create table public.factures_lignes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  facture_id uuid not null references public.factures(id) on delete cascade,

  ordre int not null default 0,
  designation text not null,
  quantite numeric(10, 3) not null default 1 check (quantite > 0),
  prix_unitaire_ht numeric(10, 2) not null check (prix_unitaire_ht >= 0),
  total_ht numeric(10, 2) not null,

  created_at timestamptz not null default now()
);

create index idx_factures_lignes_facture on public.factures_lignes(facture_id, ordre);

alter table public.factures_lignes enable row level security;

create policy "factures_lignes_owner_all"
  on public.factures_lignes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 6. DEVIS
-- =============================================================================
create table public.devis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  numero text not null,                  -- D-AAAA-NNNN
  client_id uuid not null references public.clients(id) on delete restrict,

  date_emission date not null default current_date,
  date_validite date not null default (current_date + interval '3 months')::date,

  statut text not null default 'brouillon'
    check (statut in ('brouillon','envoye','accepte','refuse','expire')),

  type_activite text not null default 'plomberie'
    check (type_activite in ('plomberie','installation_clim','installation_pac','entretien','depannage','autre')),

  total_ht numeric(10, 2) not null default 0,

  -- Travaux
  date_debut_travaux date,
  duree_estimee_jours int,

  conditions text,
  notes text,

  -- JSON : aides financières (info pour le client)
  aides_financieres jsonb not null default '{}'::jsonb,

  -- JSON : performances énergétiques (clim/PAC)
  -- { "cop": 4.2, "scop": 4.0, "seer": 7.5, "classe_energetique": "A++" }
  performances_energetiques jsonb not null default '{}'::jsonb,

  -- JSON : info équipement
  equipement_info jsonb not null default '{}'::jsonb,

  -- Signature client (PDF/image)
  signature_client_url text,
  date_signature timestamptz,

  pdf_url text,
  email_envoye_le timestamptz,

  -- Traçabilité de la conversion devis → facture
  facture_id uuid references public.factures(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, numero)
);

create index idx_devis_user_emission on public.devis(user_id, date_emission desc);
create index idx_devis_user_statut on public.devis(user_id, statut);
create index idx_devis_client on public.devis(client_id);

create trigger trg_devis_updated_at
  before update on public.devis
  for each row execute function public.set_updated_at();

alter table public.devis enable row level security;

create policy "devis_owner_all"
  on public.devis
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 6b. DEVIS_LIGNES
-- -----------------------------------------------------------------------------
create table public.devis_lignes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  devis_id uuid not null references public.devis(id) on delete cascade,

  ordre int not null default 0,
  designation text not null,
  quantite numeric(10, 3) not null default 1 check (quantite > 0),
  prix_unitaire_ht numeric(10, 2) not null check (prix_unitaire_ht >= 0),
  total_ht numeric(10, 2) not null,

  created_at timestamptz not null default now()
);

create index idx_devis_lignes_devis on public.devis_lignes(devis_id, ordre);

alter table public.devis_lignes enable row level security;

create policy "devis_lignes_owner_all"
  on public.devis_lignes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 7. PAIEMENTS
-- =============================================================================
create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  facture_id uuid not null references public.factures(id) on delete cascade,

  date_paiement date not null,
  montant numeric(10, 2) not null check (montant > 0),
  mode text not null default 'virement'
    check (mode in ('virement','cheque','especes','cb','autre')),
  reference text,
  notes text,

  created_at timestamptz not null default now()
);

create index idx_paiements_facture on public.paiements(facture_id);
create index idx_paiements_user_date on public.paiements(user_id, date_paiement desc);

alter table public.paiements enable row level security;

create policy "paiements_owner_all"
  on public.paiements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 8. INTERVENTIONS (suivi chantiers + traçabilité fluides frigorigènes)
-- =============================================================================
create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,

  date_intervention date not null,
  type text not null default 'depannage'
    check (type in ('installation','depannage','entretien','autre')),

  description text,

  -- Équipement intervenu
  equipement_marque text,
  equipement_modele text,
  equipement_num_serie text,

  -- Traçabilité fluides frigorigènes (réglementation F-Gas)
  fluide_frigo_type text,                 -- R32, R410A, R454B...
  fluide_frigo_kg_ajoute numeric(8, 3) check (fluide_frigo_kg_ajoute >= 0),
  fluide_frigo_kg_recupere numeric(8, 3) check (fluide_frigo_kg_recupere >= 0),

  duree_minutes int,

  -- Lien optionnel vers la facture générée
  facture_id uuid references public.factures(id) on delete set null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_interventions_user_date on public.interventions(user_id, date_intervention desc);
create index idx_interventions_client on public.interventions(client_id);

create trigger trg_interventions_updated_at
  before update on public.interventions
  for each row execute function public.set_updated_at();

alter table public.interventions enable row level security;

create policy "interventions_owner_all"
  on public.interventions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 9. CONTRATS DE MAINTENANCE
-- =============================================================================
create table public.contrats_maintenance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,

  intitule text,
  equipement text,
  equipement_num_serie text,

  date_debut date not null,
  date_fin date,

  frequence text not null default 'annuelle'
    check (frequence in ('annuelle','semestrielle','trimestrielle')),

  prix_annuel_ht numeric(10, 2) not null check (prix_annuel_ht >= 0),

  prochaine_visite date,

  statut text not null default 'actif'
    check (statut in ('actif','suspendu','termine')),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_contrats_user_statut on public.contrats_maintenance(user_id, statut);
create index idx_contrats_prochaine_visite on public.contrats_maintenance(user_id, prochaine_visite)
  where statut = 'actif';
create index idx_contrats_client on public.contrats_maintenance(client_id);

create trigger trg_contrats_updated_at
  before update on public.contrats_maintenance
  for each row execute function public.set_updated_at();

alter table public.contrats_maintenance enable row level security;

create policy "contrats_owner_all"
  on public.contrats_maintenance
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================================
-- 10. STORAGE : buckets privés `logos` et `pdfs`
-- -----------------------------------------------------------------------------
-- Convention : chemins préfixés par `{user_id}/...`
-- Les policies restreignent l'accès aux objets dont la racine = auth.uid()
-- =============================================================================
insert into storage.buckets (id, name, public)
  values ('logos', 'logos', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('pdfs', 'pdfs', false)
  on conflict (id) do nothing;

-- Policies storage : limiter aux objets du user dans les buckets autorisés
create policy "storage_owner_select"
  on storage.objects for select
  using (
    bucket_id in ('logos','pdfs')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id in ('logos','pdfs')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_owner_update"
  on storage.objects for update
  using (
    bucket_id in ('logos','pdfs')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "storage_owner_delete"
  on storage.objects for delete
  using (
    bucket_id in ('logos','pdfs')
    and auth.uid()::text = (storage.foldername(name))[1]
  );
