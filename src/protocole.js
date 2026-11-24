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
        valeur: vitesse,
        pct: Math.round(((vitesse * cout) / vma) * 100),
      })
      temps += duree_min
      if (paliers.at(-1).pct > 100) break
    }
    if (paliers.at(-1).pct > 100) break
  }

  return {
    unite: 'km/h',
    pente_pct,
    // Vitesse qui, sur cette pente, demande autant d'énergie que la VMA à plat
    repere: {
      valeur: arrondi(vma / cout),
      libelle: pente_pct ? `VMA (équiv. à ${pente_pct} %)` : 'VMA',
    },
    depart: depart,
    // Étapes pour décrire le protocole (la première, le départ, est décrite à part)
    sequence: sequence.slice(1).map(({ nb, duree_min, increment_kmh }) => ({
      nb: Number.isFinite(nb) ? nb : null,
      duree_min,
      increment: increment_kmh,
    })),
    duree_depart_min: sequence[0].duree_min,
    duree_max_min: temps,
    paliers,
  }
}

// Protocole vélo : rampe individualisée (Wasserman), 3 min d'échauffement puis un incrément par minute
// calculé pour atteindre la puissance maximale prédite en ~10 min (cible usuelle : 8 à 12 min).
const VELO = { duree_echauffement_min: 3, duree_rampe_min: 10, depart_min_w: 30, depart_max_w: 120 }
const ML_O2_PAR_WATT = 10.3 // coût en O2 d'un watt supplémentaire (Wasserman)
const ML_O2_PAR_KM_H_ET_KG = 3.5 // VO2max ≈ 3,5 × VMA en ml/kg/min (Léger)
const RATIO_VELO_COURSE = 0.9 // la VO2max sur vélo est ~10 % plus basse qu'en course

const arrondirA = (n, pas) => Math.round(n / pas) * pas

function definirProtocoleVelo(profil, vma, vo2max) {
  if (profil.poids_kg == null) return null
  const poids = Number(profil.poids_kg)

  // VO2max sur vélo (ml/min) : d'après la VMA si on la connaît (plus juste pour un sportif),
  // sinon d'après les équations de Hansen / Wasserman (âge, sexe, taille, poids)
  const vo2maxVelo = vma
    ? vma.valeur * ML_O2_PAR_KM_H_ET_KG * poids * RATIO_VELO_COURSE
    : vo2max?.velo && vo2max.velo.l_min * 1000
  if (!vo2maxVelo) return null

  const vo2PedalageAVide = 150 + 6 * poids // ml/min, pédalage sans charge
  const pmax = arrondirA((vo2maxVelo - vo2PedalageAVide) / ML_O2_PAR_WATT, 5)
  const depart = Math.min(VELO.depart_max_w, Math.max(VELO.depart_min_w, arrondirA(pmax * 0.25, 10)))
  const increment = Math.max(10, arrondirA((pmax - depart) / VELO.duree_rampe_min, 5))

  const paliers = []
  let puissance = depart
  let temps = 0
  const ajouter = (duree) => {
    paliers.push({
      numero: paliers.length + 1,
      debut_min: temps,
      fin_min: temps + duree,
      valeur: puissance,
      pct: Math.round((puissance / pmax) * 100),
    })
    temps += duree
  }
  ajouter(VELO.duree_echauffement_min)
  // Jusqu'au premier palier au-delà de la puissance maximale prédite : le test s'arrête à épuisement
  while (paliers.at(-1).pct <= 100) {
    puissance += increment
    ajouter(1)
  }

  return {
    unite: 'W',
    base: vma ? 'vma' : 'morphologie',
    repere: { valeur: pmax, libelle: 'Puissance max estimée' },
    depart,
    duree_depart_min: VELO.duree_echauffement_min,
    sequence: [{ nb: null, duree_min: 1, increment }],
    duree_max_min: temps,
    paliers,
  }
}

// Un protocole par bilan : route et trail d'après la VMA, vélo d'après la VMA ou la morphologie
export function definirProtocoles(profil, vo2max) {
  const vma = estimerVma(profil)
  const course = vma
    ? Object.fromEntries(Object.entries(PROTOCOLES).map(([type, config]) => [type, construireProtocole(vma.valeur, config)]))
    : { route: null, trail: null }
  const velo = definirProtocoleVelo(profil, vma, vo2max)
  if (!vma && !velo) return null
  return { vma, ...course, velo }
}

// ——— Protocole trail choisi par le client pour son rendez-vous ———

export const CHOIX_TRAIL = {
  base: 'Protocole proposé',
  bal: 'Protocole Sentier BAL',
  breche: 'Protocole BRECHE 🔥',
  perso: 'Configuration personnalisée',
}

const REGLAGES_TRAIL = {
  pente_pct: { min: 0, max: 25, libelle: 'Pente' },
  depart_kmh: { min: 2, max: 20, libelle: 'Allure de départ' },
  duree_min: { min: 0.5, max: 5, libelle: 'Durée des paliers' },
  increment_kmh: { min: 0.1, max: 2, libelle: 'Écart entre paliers' },
}

export const COLONNES_PROTOCOLE =
  'protocole_choix, protocole_pente_pct, protocole_depart_kmh, protocole_duree_min, protocole_increment_kmh'

// Valide le choix envoyé par le frontend ; renvoie les colonnes à enregistrer
export function validerProtocoleTrail(body) {
  const { choix } = body ?? {}
  if (!CHOIX_TRAIL[choix]) return { error: 'Protocole inconnu' }
  const colonnes = { protocole_choix: choix }
  for (const [cle, { min, max, libelle }] of Object.entries(REGLAGES_TRAIL)) {
    const n = Number(body[cle])
    if (!Number.isFinite(n) || n < min || n > max) return { error: `${libelle} : entre ${min} et ${max}` }
    colonnes[`protocole_${cle}`] = Math.round(n * 10) / 10
  }
  return { colonnes }
}

// Ligne de rendez_vous → protocole choisi (ou null), au même format que les protocoles calculés
export function protocoleTrailChoisi(rdv) {
  if (!rdv.protocole_choix) return null
  const duree = Number(rdv.protocole_duree_min)
  return {
    choix: rdv.protocole_choix,
    titre: CHOIX_TRAIL[rdv.protocole_choix],
    unite: 'km/h',
    pente_pct: Number(rdv.protocole_pente_pct),
    depart: Number(rdv.protocole_depart_kmh),
    duree_depart_min: duree,
    sequence: [{ nb: null, duree_min: duree, increment: Number(rdv.protocole_increment_kmh) }],
  }
}
