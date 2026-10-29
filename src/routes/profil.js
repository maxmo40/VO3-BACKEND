import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { estimerVo2max } from '../vo2max.js'

const router = Router()
router.use(requireAuth)

const COLONNES = 'prenom, nom, sexe, date_naissance, telephone, poids_kg, taille_cm, activite, updated_at'
const SEXES = ['homme', 'femme', 'autre']

const texte = (max) => (v) => {
  if (typeof v !== 'string') return { error: 'doit être un texte' }
  if (v.trim().length > max) return { error: `${max} caractères maximum` }
  return { value: v.trim() }
}

const nombre = (min, max) => (v) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max) return { error: `doit être entre ${min} et ${max}` }
  return { value: n }
}

// Chaque champ modifiable et sa validation ; une valeur vide efface le champ
const CHAMPS = {
  prenom: texte(100),
  nom: texte(100),
  telephone: (v) =>
    /^\+?[0-9 .()-]{6,30}$/.test(String(v).trim())
      ? { value: String(v).trim() }
      : { error: 'numéro invalide' },
  sexe: (v) => (SEXES.includes(v) ? { value: v } : { error: 'valeur invalide' }),
  date_naissance: (v) => {
    const date = new Date(v)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(date)) return { error: 'date invalide' }
    if (date > new Date() || date.getFullYear() < 1900) return { error: 'date invalide' }
    return { value: v }
  },
  poids_kg: nombre(1, 499),
  taille_cm: (v) => {
    const result = nombre(30, 300)(v)
    return result.error ? result : { value: Math.round(result.value) }
  },
  activite: (v) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 && n <= 7 ? { value: n } : { error: 'doit être entre 0 et 7' }
  },
}

const LIBELLES = {
  prenom: 'Prénom',
  nom: 'Nom',
  telephone: 'Téléphone',
  sexe: 'Sexe',
  date_naissance: 'Date de naissance',
  poids_kg: 'Poids',
  taille_cm: 'Taille',
  activite: "Niveau d'activité",
}

// Le profil renvoyé au frontend inclut l'estimation de VO2max calculée à partir des données enregistrées
const avecVo2max = (profil) => ({ ...profil, vo2max: estimerVo2max(profil) })

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('COMPTES')
    .select(COLONNES)
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  res.json(avecVo2max(data ?? {}))
})

router.put('/', async (req, res) => {
  const updates = {}
  for (const [champ, valider] of Object.entries(CHAMPS)) {
    if (!(champ in (req.body ?? {}))) continue
    const valeur = req.body[champ]
    if (valeur === null || valeur === '') {
      updates[champ] = null
      continue
    }
    const { value, error } = valider(valeur)
    if (error) return res.status(400).json({ error: `${LIBELLES[champ]} : ${error}` })
    updates[champ] = value
  }

  // upsert : crée la ligne si elle n'existe pas encore (compte antérieur à la migration)
  const { data, error } = await supabase
    .from('COMPTES')
    .upsert({ user_id: req.user.id, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select(COLONNES)
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json(avecVo2max(data))
})

export default router
