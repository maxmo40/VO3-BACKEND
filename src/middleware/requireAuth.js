import { supabase } from '../supabase.js'

// Vérifie le jeton envoyé par le frontend et place l'utilisateur dans req.user
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  if (!token) return res.status(401).json({ error: 'Non connecté' })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return res.status(401).json({ error: 'Session invalide' })

  req.user = data.user
  next()
}
