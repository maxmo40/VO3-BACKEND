// VO2max théorique selon Hansen, Sue & Wasserman (1984), reprises dans
// Wasserman, « Principles of Exercise Testing and Interpretation ».
// Équations établies sur ergocycle ; sur tapis, la VO2max est ~11 % plus élevée (× 1,11).
//
// Poids théorique (kg) : homme 0,79 × taille − 60,7 ; femme 0,65 × taille − 42,8 (taille en cm)
// Homme (ml/min) :
//   poids ≥ théorique : Pth × (50,72 − 0,372 × âge) + 6 × (poids − Pth)
//   poids < théorique : (Pth + poids) / 2 × (50,72 − 0,372 × âge)
// Femme (ml/min) :
//   poids ≥ théorique : (Pth + 43) × (22,78 − 0,17 × âge) + 6 × (poids − Pth)
//   poids < théorique : ((Pth + poids) / 2 + 43) × (22,78 − 0,17 × âge)

const FACTEUR_TAPIS = 1.11

const EQUATIONS = {
  homme: (poids, taille, age) => {
    const pth = 0.79 * taille - 60.7
    const facteurAge = 50.72 - 0.372 * age
    return poids >= pth ? pth * facteurAge + 6 * (poids - pth) : ((pth + poids) / 2) * facteurAge
  },
  femme: (poids, taille, age) => {
    const pth = 0.65 * taille - 42.8
    const facteurAge = 22.78 - 0.17 * age
    return poids >= pth ? (pth + 43) * facteurAge + 6 * (poids - pth) : ((pth + poids) / 2 + 43) * facteurAge
  },
}

// Pas d'équation dédiée : moyenne des équations homme et femme
const vo2Absolue = (sexe, poids, taille, age) =>
  sexe === 'autre'
    ? (EQUATIONS.homme(poids, taille, age) + EQUATIONS.femme(poids, taille, age)) / 2
    : EQUATIONS[sexe](poids, taille, age)

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
}

const arrondi = (n, decimales) => Math.max(0, Math.round(n * 10 ** decimales) / 10 ** decimales)

const resultat = (mlMin, poids) => ({ ml_kg_min: arrondi(mlMin / poids, 1), l_min: arrondi(mlMin / 1000, 2) })

// Renvoie { velo, tapis, age } ou { manquants } si des informations nécessaires ne sont pas renseignées
export function estimerVo2max(profil) {
  const manquants = Object.keys(LIBELLES).filter((champ) => profil[champ] == null)
  if (manquants.length) return { manquants: manquants.map((c) => LIBELLES[c]) }

  const age = calculerAge(profil.date_naissance)
  if (age < 18) return { raison: 'Estimation disponible à partir de 18 ans' }

  const poids = Number(profil.poids_kg)
  const velo = vo2Absolue(profil.sexe, poids, profil.taille_cm, age)

  return { velo: resultat(velo, poids), tapis: resultat(velo * FACTEUR_TAPIS, poids), age }
}
