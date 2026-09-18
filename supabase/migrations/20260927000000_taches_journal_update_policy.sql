-- La sauvegarde manuelle (client de session) fait un upsert dans
-- taches_journal : la seconde du même jour devient un UPDATE, que la
-- RLS refusait faute de politique (l'échec était silencieux). Additif.
create policy "taches_journal_owner_update"
  on public.taches_journal for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
