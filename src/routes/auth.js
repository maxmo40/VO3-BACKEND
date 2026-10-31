import { Router } from 'express'
import { supabase, createAuthClient } from '../supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { isAdmin } from '../middleware/requireAdmin.js'

const router = Router()

const toSessionResponse = ({ session, user }) => ({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: session.expires_at,
  user: { id: user.id, email: user.email, is_admin: isAdmin(user) },
})

const validateCredentials = (email, password) => {
  if (!email || !password) return 'Email et mot de passe requis'
  if (password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères'
  return null
}

router.post('/signup', async (req, res) => {
  const { email, password } = req.body ?? {}
  const invalid = validateCredentials(email, password)
  if (invalid) return res.status(400).json({ error: invalid })

  // Compte créé déjà confirmé, pour éviter l'étape d'email de confirmation
  const { error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError) {
    const alreadyExists = createError.code === 'email_exists' || createError.status === 422
    return res
      .status(alreadyExists ? 409 : 400)
      .json({ error: alreadyExists ? 'Un compte existe déjà avec cet email' : createError.message })
  }

  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password })
  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json(toSessionResponse(data))
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  const invalid = validateCredentials(email, password)
  if (invalid) return res.status(400).json({ error: invalid })

  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
  res.json(toSessionResponse(data))
})

router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body ?? {}
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token requis' })

  const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token })
  if (error || !data.session) return res.status(401).json({ error: 'Session expirée' })
  res.json(toSessionResponse(data))
})

router.get('/me', requireAuth, (req, res) => {
  const { id, email, created_at } = req.user
  res.json({ id, email, created_at, is_admin: isAdmin(req.user) })
})

export default router
