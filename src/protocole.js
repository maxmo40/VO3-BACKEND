// Pourcentage de VMA que l'on peut tenir en moyenne sur chaque distance (milieu des fourchettes
// usuelles : 5 km 90-95 %, 10 km 85-90 %, semi 80-85 %, marathon 75-80 %)
export const DISTANCES = {
  temps_5k_s: { libelle: '5 km', km: 5, pct_vma: 0.925, min_s: 600, max_s: 7200 },
  temps_10k_s: { libelle: '10 km', km: 10, pct_vma: 0.875, min_s: 1200, max_s: 10800 },
  temps_semi_s: { libelle: 'Semi-marathon', km: 21.0975, pct_vma: 0.825, min_s: 3000, max_s: 18000 },
  temps_marathon_s: { libelle: 'Marathon', km: 42.195, pct_vma: 0.775, min_s: 6600, max_s: 28800 },
}

// Protocoles du test sur tapis, selon le bilan réservé
const PROTOCOLES = {
  route: { pente_pct: 0, ecart_depart_kmh: 6, vitesse_min_kmh: 6, increment_kmh: 1, duree_palier_min: 1 },
  trail: { pente_pct: 10, ecart_depart_kmh: 10, vitesse_min_kmh: 4, increment_kmh: 0.5, duree_palier_min: 1 },
}

// Coût énergétique relatif de la course en pente (équation ACSM : 0,2 × v + 0,9 × v × pente).
// Sert à exprimer chaque vitesse en % de VMA « équivalent plat ».
const coutRelatif = (pentePct) => (0.2 + 0.9 * (pentePct / 100)) / 0.2

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

function construireProtocole(vma, { pente_pct, ecart_depart_kmh, vitesse_min_kmh, increment_kmh, duree_palier_min }) {
  const depart = Math.max(vitesse_min_kmh, Math.floor(vma) - ecart_depart_kmh)
  const cout = coutRelatif(pente_pct)
  const paliers = []
  // On monte jusqu'au premier palier au-dessus de la VMA (équivalent plat) : le test s'arrête à épuisement
  let vitesse = depart
  do {
    const numero = paliers.length + 1
    paliers.push({
      numero,
      debut_min: (numero - 1) * duree_palier_min,
      fin_min: numero * duree_palier_min,
      vitesse_kmh: vitesse,
      pct_vma: Math.round(((vitesse * cout) / vma) * 100),
    })
    vitesse += increment_kmh
  } while (paliers.at(-1).pct_vma <= 100)

  return {
    pente_pct,
    depart_kmh: depart,
    increment_kmh,
    duree_palier_min,
    duree_max_min: paliers.length * duree_palier_min,
    paliers,
  }
}

// Un protocole par bilan course ; le bilan vélo se règle en watts le jour de l'examen
export function definirProtocoles(profil) {
  const vma = estimerVma(profil)
  if (!vma) return null
  return {
    vma,
    ...Object.fromEntries(Object.entries(PROTOCOLES).map(([type, config]) => [type, construireProtocole(vma.valeur, config)])),
  }
}
