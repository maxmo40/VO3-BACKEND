// Pourcentage de VMA que l'on peut tenir en moyenne sur chaque distance (milieu des fourchettes
// usuelles : 5 km 90-95 %, 10 km 85-90 %, semi 80-85 %, marathon 75-80 %)
export const DISTANCES = {
  temps_5k_s: { libelle: '5 km', km: 5, pct_vma: 0.925, min_s: 600, max_s: 7200 },
  temps_10k_s: { libelle: '10 km', km: 10, pct_vma: 0.875, min_s: 1200, max_s: 10800 },
  temps_semi_s: { libelle: 'Semi-marathon', km: 21.0975, pct_vma: 0.825, min_s: 3000, max_s: 18000 },
  temps_marathon_s: { libelle: 'Marathon', km: 42.195, pct_vma: 0.775, min_s: 6600, max_s: 28800 },
}

// Protocoles du test sur tapis, selon le bilan réservé. Chaque protocole part de VMA - ecart_depart_kmh,
// puis enchaîne les étapes de sa séquence ; la dernière étape se répète jusqu'à la fin du test.
// Une étape = `nb` paliers de `duree_min` minutes, chacun `increment_kmh` plus rapide que le précédent.
const PROTOCOLES = {
  route: {
    pente_pct: 0,
    ecart_depart_kmh: 8,
    vitesse_min_kmh: 6,
    sequence: [
      { nb: 1, duree_min: 1, increment_kmh: 0 },
      { nb: 1, duree_min: 2, increment_kmh: 1 },
      { nb: 2, duree_min: 2, increment_kmh: 2 },
      { nb: Infinity, duree_min: 1, increment_kmh: 0.5 },
    ],
  },
  trail: {
    pente_pct: 10,
    ecart_depart_kmh: 10,
    vitesse_min_kmh: 4,
    sequence: [
      { nb: 1, duree_min: 1, increment_kmh: 0 },
      { nb: Infinity, duree_min: 1, increment_kmh: 0.5 },
    ],
  },
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

function construireProtocole(vma, { pente_pct, ecart_depart_kmh, vitesse_min_kmh, sequence }) {
  const depart = Math.max(vitesse_min_kmh, Math.floor(vma) - ecart_depart_kmh)
  const cout = coutRelatif(pente_pct)
  const paliers = []
  let vitesse = depart
  let temps = 0

  // On enchaîne les étapes jusqu'au premier palier au-dessus de la VMA (équivalent plat) :
  // le test s'arrête à épuisement
  for (const { nb, duree_min, increment_kmh } of sequence) {
    for (let i = 0; i < nb; i++) {
      if (paliers.length) vitesse += increment_kmh
      paliers.push({
        numero: paliers.length + 1,
        debut_min: temps,
        fin_min: temps + duree_min,
        vitesse_kmh: vitesse,
        pct_vma: Math.round(((vitesse * cout) / vma) * 100),
      })
      temps += duree_min
      if (paliers.at(-1).pct_vma > 100) break
    }
    if (paliers.at(-1).pct_vma > 100) break
  }

  return {
    pente_pct,
    // Vitesse qui, sur cette pente, demande autant d'énergie que la VMA à plat
    vitesse_vma_kmh: arrondi(vma / cout),
    depart_kmh: depart,
    // Étapes pour décrire le protocole (la première, le départ, est décrite à part)
    sequence: sequence.slice(1).map(({ nb, duree_min, increment_kmh }) => ({
      nb: Number.isFinite(nb) ? nb : null,
      duree_min,
      increment_kmh,
    })),
    duree_depart_min: sequence[0].duree_min,
    duree_max_min: temps,
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
