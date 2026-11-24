-- Droit à l'image et consentements RGPD de chaque client (une ligne par utilisateur).
-- updated_at date le dernier changement : c'est la preuve du consentement en vigueur.
create table public.consentements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- null tant que le client n'a pas répondu
  droit_image boolean,
  donnees_personnelles boolean not null default false,
  politique_confidentialite boolean not null default false,
  analyse_performance boolean not null default false,
  informations_exactes boolean not null default false,
  contact boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Le backend (clé secrète) enregistre les choix ; un utilisateur connecté ne peut lire que les siens
alter table public.consentements enable row level security;

create policy "Lecture de ses propres consentements"
  on public.consentements for select to authenticated
  using ((select auth.uid()) = user_id);
