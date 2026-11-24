-- Protocole trail choisi par le client pour son rendez-vous, avec les réglages du tapis figés au moment
-- du choix (les variantes Sentier BAL et BRECHE dépendent de la VMA du client à cette date).
-- Sans choix enregistré, le centre applique le protocole proposé par défaut.
alter table public.rendez_vous
  add column protocole_choix text check (protocole_choix in ('base', 'bal', 'breche', 'perso')),
  add column protocole_pente_pct numeric(3, 1) check (protocole_pente_pct between 0 and 25),
  add column protocole_depart_kmh numeric(3, 1) check (protocole_depart_kmh between 2 and 20),
  add column protocole_duree_min numeric(2, 1) check (protocole_duree_min between 0.5 and 5),
  add column protocole_increment_kmh numeric(2, 1) check (protocole_increment_kmh between 0.1 and 2),
  -- Soit aucun réglage, soit tous
  add constraint rendez_vous_protocole_complet check (
    num_nulls(protocole_choix, protocole_pente_pct, protocole_depart_kmh, protocole_duree_min, protocole_increment_kmh)
      in (0, 5)
  );
