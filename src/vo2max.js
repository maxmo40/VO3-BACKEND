// Estimation de la VO2max sans test d'effort : modèle IMC de Jackson et al. (1990)
// VO2max (ml/kg/min) = 56.363 + 1.921 × activité − 0.381 × âge − 0.754 × IMC + 10.987 × sexe
// avec activité sur l'échelle PA-R (0 à 7) et sexe = 1 pour un homme, 0 pour une femme.
// Erreur standard du modèle : environ 5 ml/kg/min.

const COEF_SEXE = { homme: 1, femme: 0, autre: 0.5 }

const calculerAge = (dateNaissance) => {
  const naissance = new Date(dateNaissance)
  const today = new Date()
  let age = today.getFullYear() - naissance.getFullYear()
  const anniversairePasse =
    today.getMonth() > naissance.getMonth() ||
    (today.getMonth() === naissance.getMonth() && today.getDate() >= naissance.getDate())
  if (!anniversairePasse) age--
  return age
}

const LIBELLES = {
  sexe: 'sexe',
  date_naissance: 'date de naissance',
  poids_kg: 'poids',
  taille_cm: 'taille',
  activite: "niveau d'activité",
}

// Renvoie { valeur } ou { manquants } si des informations nécessaires ne sont pas renseignées
export function estimerVo2max(profil) {
  const manquants = Object.keys(LIBELLES).filter((champ) => profil[champ] == null)
  if (manquants.length) return { valeur: null, manquants: manquants.map((c) => LIBELLES[c]) }

  const age = calculerAge(profil.date_naissance)
  if (age < 18) return { valeur: null, raison: 'Estimation disponible à partir de 18 ans' }

  const tailleM = profil.taille_cm / 100
  const imc = profil.poids_kg / (tailleM * tailleM)
  const valeur =
    56.363 + 1.921 * profil.activite - 0.381 * age - 0.754 * imc + 10.987 * COEF_SEXE[profil.sexe]

  return { valeur: Math.max(0, Math.round(valeur * 10) / 10), age, imc: Math.round(imc * 10) / 10 }
}
