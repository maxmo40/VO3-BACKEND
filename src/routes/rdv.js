import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { BILANS, DUREE_BILAN_MINUTES, genererCreneaux } from '../creneaux.js'

const router = Router()

// Délai minimum pour annuler soi-même un rendez-vous
const DELAI_ANNULATION_HEURES = 24

const estAnnulable = (rdv) =>
  rdv.statut !== 'annule' && Date.now() <= new Date(rdv.debut).getTime() - DELAI_ANNULATION_HEURES * 3600_000

// Créneaux déjà pris (un seul praticien : un créneau réservé l'est pour tous les bilans)
const creneauxReserves = async (depuis) => {
  const { data, error } = await supabase
    .from('rendez_vous')
    .select('debut')
    .neq('statut', 'annule')
    .gte('debut', depuis)
  if (error) throw error
  return new Set(data.map((r) => new Date(r.debut).toISOString()))
}

router.get('/bilans', (req, res) => {
  res.json(Object.entries(BILANS).map(([type, bilan]) => ({ type, ...bilan, duree_minutes: DUREE_BILAN_MINUTES })))
})

router.get('/creneaux', async (req, res) => {
  const creneaux = genererCreneaux()
  try {
    const reserves = await creneauxReserves(creneaux[0])
    res.json(creneaux.filter((c) => !reserves.has(c)))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/mes-rdv', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('rendez_vous')
    .select('id, type_bilan, debut, prix_centimes, statut')
    .eq('user_id', req.user.id)
    .neq('statut', 'annule')
    .order('debut', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data.map((r) => ({ ...r, libelle: BILANS[r.type_bilan]?.libelle, annulable: estAnnulable(r) })))
})

// Réservation + paiement (simulé pour l'instant : le rendez-vous est confirmé directement)
router.post('/', requireAuth, async (req, res) => {
  const { type_bilan, debut } = req.body ?? {}
  const bilan = BILANS[type_bilan]
  if (!bilan) return res.status(400).json({ error: 'Bilan inconnu' })

  const debutIso = typeof debut === 'string' && !isNaN(new Date(debut)) && new Date(debut).toISOString()
  if (!debutIso || !genererCreneaux().includes(debutIso)) {
    return res.status(400).json({ error: "Ce créneau n'est pas disponible" })
  }

  const { data, error } = await supabase
    .from('rendez_vous')
    .insert({ user_id: req.user.id, type_bilan, debut: debutIso, prix_centimes: bilan.prix_centimes })
    .select('id, type_bilan, debut, prix_centimes, statut')
    .single()

  // 23505 = violation de l'index unique : quelqu'un vient de réserver ce créneau
  if (error?.code === '23505') {
    return res.status(409).json({ error: "Ce créneau vient d'être réservé, choisissez-en un autre" })
  }
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ ...data, libelle: bilan.libelle, annulable: estAnnulable(data) })
})

router.post('/:id/annuler', requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'Rendez-vous introuvable' })

  const { data: rdv, error } = await supabase
    .from('rendez_vous')
    .select('id, debut, statut')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!rdv) return res.status(404).json({ error: 'Rendez-vous introuvable' })
  if (rdv.statut === 'annule') return res.status(409).json({ error: 'Ce rendez-vous est déjà annulé' })

  if (!estAnnulable(rdv)) {
    return res.status(409).json({
      error: `Annulation impossible moins de ${DELAI_ANNULATION_HEURES} h avant le rendez-vous : contactez-nous`,
    })
  }

  // Le statut « annule » libère le créneau (l'index unique ignore les rendez-vous annulés)
  const { data, error: updateError } = await supabase
    .from('rendez_vous')
    .update({ statut: 'annule' })
    .eq('id', rdv.id)
    .eq('user_id', req.user.id)
    .select('id, type_bilan, debut, prix_centimes, statut')
    .single()
  if (updateError) return res.status(500).json({ error: updateError.message })
  res.json({ ...data, libelle: BILANS[data.type_bilan]?.libelle, annulable: false })
})

export default router
