-- Rendez-vous pour les bilans de performance
create table public.rendez_vous (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type_bilan text not null check (type_bilan in ('route', 'trail', 'velo')),
  debut timestamptz not null,
  prix_centimes integer not null check (prix_centimes >= 0),
  statut text not null default 'confirme' check (statut in ('confirme', 'annule')),
  created_at timestamptz not null default now()
);

-- Un seul rendez-vous actif par créneau : empêche deux réservations simultanées du même horaire
create unique index rendez_vous_creneau_unique on public.rendez_vous (debut) where statut <> 'annule';

create index rendez_vous_user_id_idx on public.rendez_vous (user_id);

-- Le backend (clé secrète) gère les réservations ; un utilisateur connecté ne peut lire que les siennes
alter table public.rendez_vous enable row level security;

create policy "Lecture de ses propres rendez-vous"
  on public.rendez_vous for select to authenticated
  using ((select auth.uid()) = user_id);
