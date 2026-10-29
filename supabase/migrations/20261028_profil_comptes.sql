-- Transforme COMPTES en table de profil liée à Supabase Auth (une ligne par utilisateur)

alter table public."COMPTES"
  add column user_id uuid not null unique references auth.users (id) on delete cascade,
  add column prenom text check (char_length(prenom) <= 100),
  add column nom text check (char_length(nom) <= 100),
  add column sexe text check (sexe in ('homme', 'femme', 'autre')),
  add column date_naissance date,
  add column telephone text check (char_length(telephone) <= 30),
  add column poids_kg numeric(5, 1) check (poids_kg > 0 and poids_kg < 500),
  add column taille_cm smallint check (taille_cm between 30 and 300),
  add column updated_at timestamptz not null default now();

-- Seul le backend (clé secrète) accède à la table ; un utilisateur connecté
-- peut aussi lire et modifier sa propre ligne si le frontend l'interroge un jour directement.
alter table public."COMPTES" enable row level security;

create policy "Lecture de son propre profil"
  on public."COMPTES" for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Modification de son propre profil"
  on public."COMPTES" for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Crée automatiquement une ligne de profil à chaque inscription
create function public.creer_profil_compte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public."COMPTES" (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.creer_profil_compte();

-- Profils pour les utilisateurs déjà inscrits
insert into public."COMPTES" (user_id)
select id from auth.users
on conflict (user_id) do nothing;
