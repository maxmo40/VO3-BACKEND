-- Niveau d'activité physique (échelle PA-R de 0 à 7), utilisé pour estimer la VO2max
alter table public."COMPTES"
  add column activite smallint check (activite between 0 and 7);
