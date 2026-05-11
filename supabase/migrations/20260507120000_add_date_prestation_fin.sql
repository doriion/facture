-- Permet aux factures de couvrir une période de prestation (plusieurs jours)
-- date_prestation = date de début, date_prestation_fin = date de fin (optionnel)
alter table public.factures
  add column date_prestation_fin date;

-- Contrainte : si les deux dates sont renseignées, fin >= début
alter table public.factures
  add constraint factures_prestation_dates_check
  check (
    date_prestation_fin is null
    or date_prestation is null
    or date_prestation_fin >= date_prestation
  );
