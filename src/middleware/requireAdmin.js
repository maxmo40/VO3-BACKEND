// Admins désignés par la variable d'environnement ADMIN_EMAILS (emails séparés par des virgules)
const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

export const isAdmin = (user) => Boolean(user?.email) && adminEmails().includes(user.email.toLowerCase())

// À placer après requireAuth
export function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Accès réservé aux administrateurs' })
  next()
}
