import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

// Consentements sans lesquels on ne peut pas réserver de bilan
export const CONSENTEMENTS_REQUIS = ['politique_confidentialite', 'informations_exactes']

const CHAMPS = [
  'droit_image',
  'donnees_personnelles',
  'politique_confidentialite',
  'analyse_performance',
  'informations_exactes',
  'contact',
]

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('consentements')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Mise à jour partielle : seuls les champs envoyés sont modifiés
router.put('/', async (req, res) => {
  const updates = {}
  for (const champ of CHAMPS) {
    if (!(champ in (req.body ?? {}))) continue
    if (typeof req.body[champ] !== 'boolean') return res.status(400).json({ error: 'Valeur invalide' })
    updates[champ] = req.body[champ]
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Aucun choix à enregistrer' })

  const { data, error } = await supabase
    .from('consentements')
    .upsert({ user_id: req.user.id, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
