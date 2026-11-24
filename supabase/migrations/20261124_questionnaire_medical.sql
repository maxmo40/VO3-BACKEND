-- Questionnaire médical pré-test : dernières réponses de chaque sportif (une ligne par utilisateur).
-- Données de santé : l'hébergement doit être certifié HDS en production.
create table public.questionnaire_medical (
  user_id uuid primary key references auth.users (id) on delete cascade,
  age smallint not null check (age between 1 and 120),
  suivi_cardio boolean not null,
  -- Facteurs de risque cardio-vasculaire
  hta boolean not null default false,
  diabete boolean not null default false,
  hypercholesterolemie boolean not null default false,
  tabagisme boolean not null default false,
  -- Antécédents et traitements (texte libre)
  antecedents_medicaux text check (char_length(antecedents_medicaux) <= 1000),
  antecedents_chirurgicaux text check (char_length(antecedents_chirurgicaux) <= 1000),
  antecedents_familiaux text check (char_length(antecedents_familiaux) <= 1000),
  traitements text check (char_length(traitements) <= 1000),
  -- Symptômes actuels
  douleur_thoracique boolean not null default false,
  essoufflement boolean not null default false,
  palpitations boolean not null default false,
  malaise boolean not null default false,
  -- Calculé par le backend : âge > 35 ans, suivi cardio, facteur de risque ou symptôme
  consultation_recommandee boolean not null,
  updated_at timestamptz not null default now()
);

-- Le backend (clé secrète) enregistre les réponses ; un utilisateur connecté ne peut lire que les siennes
alter table public.questionnaire_medical enable row level security;

create policy "Lecture de son propre questionnaire"
  on public.questionnaire_medical for select to authenticated
  using ((select auth.uid()) = user_id);
