import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_URL et SUPABASE_SECRET_KEY doivent être définis dans .env')
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  options
)

// Client jetable pour les connexions : signInWithPassword attache la session
// de l'utilisateur au client, il ne faut donc pas réutiliser le client partagé.
export const createAuthClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, options)
