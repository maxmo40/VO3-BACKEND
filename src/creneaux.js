// Bilans proposés et génération des créneaux à horaires fixes (heure de Paris)

export const BILANS = {
  route: { libelle: 'Bilan de performance route', prix_centimes: 14900 },
  trail: { libelle: 'Bilan de performance trail', prix_centimes: 14900 },
  velo: { libelle: 'Bilan de performance vélo', prix_centimes: 14900 },
}

const FUSEAU = 'Europe/Paris'
const JOURS_OUVRES = [1, 2, 3, 4, 5] // lundi → vendredi
const HEURE_OUVERTURE = 9 * 60 // en minutes
const HEURE_FERMETURE = 18 * 60
const DUREE_BILAN = 90
const NB_JOURS = 28

// Décalage (en minutes) entre l'heure de Paris et UTC à un instant donné (gère l'heure d'été)
const decalageParis = (date) => {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSEAU,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  )
  const commeUtc = Date.UTC(parties.year, parties.month - 1, parties.day, parties.hour, parties.minute)
  return (commeUtc - date.getTime()) / 60000
}

// Convertit une date + heure locale de Paris en instant UTC
const heureDeParis = (annee, mois, jour, minutes) => {
  const approx = new Date(Date.UTC(annee, mois, jour, 0, minutes))
  return new Date(approx.getTime() - decalageParis(approx) * 60000)
}

// Tous les créneaux théoriques, du lendemain jusqu'à NB_JOURS jours
export function genererCreneaux(maintenant = new Date()) {
  const creneaux = []
  for (let i = 1; i <= NB_JOURS; i++) {
    const jour = new Date(maintenant.getTime() + i * 86400000)
    const [annee, mois, date] = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU })
      .format(jour)
      .split('-')
      .map(Number)
    const jourSemaine = new Date(Date.UTC(annee, mois - 1, date)).getUTCDay()
    if (!JOURS_OUVRES.includes(jourSemaine)) continue

    for (let m = HEURE_OUVERTURE; m + DUREE_BILAN <= HEURE_FERMETURE; m += DUREE_BILAN) {
      creneaux.push(heureDeParis(annee, mois - 1, date, m).toISOString())
    }
  }
  return creneaux
}

export const DUREE_BILAN_MINUTES = DUREE_BILAN
