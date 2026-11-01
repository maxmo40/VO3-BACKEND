// Pourcentage de VMA que l'on peut tenir en moyenne sur chaque distance (milieu des fourchettes
// usuelles : 5 km 90-95 %, 10 km 85-90 %, semi 80-85 %, marathon 75-80 %)
export const DISTANCES = {
  temps_5k_s: { libelle: '5 km', km: 5, pct_vma: 0.925, min_s: 600, max_s: 7200 },
  temps_10k_s: { libelle: '10 km', km: 10, pct_vma: 0.875, min_s: 1200, max_s: 10800 },
  temps_semi_s: { libelle: 'Semi-marathon', km: 21.0975, pct_vma: 0.825, min_s: 3000, max_s: 18000 },
  temps_marathon_s: { libelle: 'Marathon', km: 42.195, pct_vma: 0.775, min_s: 6600, max_s: 28800 },
}

// Protocole du test sur tapis : départ 6 km/h sous la VMA, +1 km/h toutes les minutes
const ECART_DEPART_KMH = 6
const VITESSE_DEPART_MIN = 6
const INCREMENT_KMH = 1
const DUREE_PALIER_MIN = 1

const arrondi = (n) => Math.round(n * 10) / 10

// VMA renseignée en priorité ; sinon moyenne des VMA déduites de chaque temps de course
export function estimerVma(profil) {
  if (profil.vma_kmh != null) return { valeur: Number(profil.vma_kmh), source: 'renseignee', detail: [] }

  const detail = Object.entries(DISTANCES)
    .filter(([champ]) => profil[champ] != null)
    .map(([champ, { libelle, km, pct_vma }]) => {
      const vitesse = km / (profil[champ] / 3600)
      return { libelle, vitesse_kmh: arrondi(vitesse), vma_kmh: arrondi(vitesse / pct_vma) }
    })
  if (!detail.length) return null

  const moyenne = detail.reduce((somme, d) => somme + d.vma_kmh, 0) / detail.length
  return { valeur: arrondi(moyenne), source: 'estimee', detail }
}

export function definirProtocole(profil) {
  const vma = estimerVma(profil)
  if (!vma) return null

  const depart = Math.max(VITESSE_DEPART_MIN, Math.floor(vma.valeur) - ECART_DEPART_KMH)
  const paliers = []
  // On monte jusqu'au premier palier au-dessus de la VMA : le test s'arrête à épuisement
  let vitesse = depart
  do {
    const numero = paliers.length + 1
    paliers.push({
      numero,
      debut_min: (numero - 1) * DUREE_PALIER_MIN,
      fin_min: numero * DUREE_PALIER_MIN,
      vitesse_kmh: vitesse,
      pct_vma: Math.round((vitesse / vma.valeur) * 100),
    })
    vitesse += INCREMENT_KMH
  } while (paliers.at(-1).vitesse_kmh <= vma.valeur)

  return {
    vma,
    depart_kmh: depart,
    increment_kmh: INCREMENT_KMH,
    duree_palier_min: DUREE_PALIER_MIN,
    duree_max_min: paliers.length * DUREE_PALIER_MIN,
    paliers,
  }
}
