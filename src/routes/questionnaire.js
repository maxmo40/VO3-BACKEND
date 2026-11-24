import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

const AGE_LIMITE = 35
const FACTEURS_RISQUE = ['hta', 'diabete', 'hypercholesterolemie', 'tabagisme']
const SYMPTOMES = ['douleur_thoracique', 'essoufflement', 'palpitations', 'malaise']
const TEXTES = ['antecedents_medicaux', 'antecedents_chirurgicaux', 'antecedents_familiaux', 'traitements']
const TEXTE_MAX = 1000

// Orientation vers le cardiologue du sport avant l'épreuve
export const consultationRecommandee = (q) =>
  q.age > AGE_LIMITE || q.suivi_cardio || [...FACTEURS_RISQUE, ...SYMPTOMES].some((champ) => q[champ])

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('questionnaire_medical')
    .select('*')
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.put('/', async (req, res) => {
  const body = req.body ?? {}

  const age = Number(body.age)
  if (!Number.isInteger(age) || age < 1 || age > 120) return res.status(400).json({ error: 'Âge invalide' })
  if (typeof body.suivi_cardio !== 'boolean') {
    return res.status(400).json({ error: 'Indique si tu as un suivi cardiologique' })
  }

  const reponses = { age, suivi_cardio: body.suivi_cardio }
  for (const champ of [...FACTEURS_RISQUE, ...SYMPTOMES]) reponses[champ] = body[champ] === true
  for (const champ of TEXTES) {
    const valeur = body[champ]
    if (valeur != null && typeof valeur !== 'string') return res.status(400).json({ error: 'Texte invalide' })
    const texte = valeur?.trim() ?? ''
    if (texte.length > TEXTE_MAX) return res.status(400).json({ error: `${TEXTE_MAX} caractères maximum par champ` })
    reponses[champ] = texte || null
  }

  const { data, error } = await supabase
    .from('questionnaire_medical')
    .upsert(
      {
        user_id: req.user.id,
        ...reponses,
        consultation_recommandee: consultationRecommandee(reponses),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
