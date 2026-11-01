-- Performances déclarées par le sportif : VMA et records sur route (temps en secondes)
alter table public."COMPTES"
  add column if not exists vma_kmh numeric(3, 1) check (vma_kmh between 6 and 30),
  add column if not exists temps_5k_s integer check (temps_5k_s between 600 and 7200),
  add column if not exists temps_10k_s integer check (temps_10k_s between 1200 and 10800),
  add column if not exists temps_semi_s integer check (temps_semi_s between 3000 and 18000),
  add column if not exists temps_marathon_s integer check (temps_marathon_s between 6600 and 28800);
