import { Router } from 'express'
import { supabase } from '../supabase.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { BILANS, DUREE_BILAN_MINUTES } from '../creneaux.js'
import { COLONNES_PROTOCOLE, definirProtocoles, protocoleTrailChoisi } from '../protocole.js'
import { estimerVo2max } from '../vo2max.js'

const router = Router()

router.use(requireAuth, requireAdmin)

// Agenda : tous les rendez-vous à venir, avec les coordonnées du client
router.get('/rdv', async (req, res) => {
  // Un rendez-vous déjà commencé reste affiché jusqu'à sa fin
  const depuis = new Date(Date.now() - DUREE_BILAN_MINUTES * 60_000).toISOString()
  const { data: rdvs, error } = await supabase
    .from('rendez_vous')
    .select(`id, user_id, type_bilan, debut, prix_centimes, statut, ${COLONNES_PROTOCOLE}`)
    .neq('statut', 'annule')
    .gte('debut', depuis)
    .order('debut', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })

  const userIds = [...new Set(rdvs.map((r) => r.user_id))]
  if (!userIds.length) return res.json([])

  const [{ data: comptes, error: comptesError }, utilisateurs] = await Promise.all([
    supabase.from('COMPTES').select('*').in('user_id', userIds),
    Promise.all(userIds.map((id) => supabase.auth.admin.getUserById(id))),
  ])
  if (comptesError) return res.status(500).json({ error: comptesError.message })

  const profils = new Map(comptes.map((c) => [c.user_id, c]))
  const emails = new Map(utilisateurs.map(({ data }) => [data.user?.id, data.user?.email]))

  res.json(
    rdvs.map(({ user_id, protocole_choix, protocole_pente_pct, protocole_depart_kmh, protocole_duree_min, protocole_increment_kmh, ...rdv }) => {
      const profil = profils.get(user_id)
      // Protocole à régler : celui choisi par le client (trail), sinon celui calculé d'après son profil
      const calcules = profil ? definirProtocoles(profil, estimerVo2max(profil)) : null
      const choisi = protocoleTrailChoisi({ protocole_choix, protocole_pente_pct, protocole_depart_kmh, protocole_duree_min, protocole_increment_kmh })
      const parDefaut = calcules?.[rdv.type_bilan]
      return {
        ...rdv,
        protocole: choisi ?? (parDefaut && { ...parDefaut, titre: 'Protocole proposé', par_defaut: true }),
        vma: calcules?.vma?.valeur ?? null,
        libelle: BILANS[rdv.type_bilan]?.libelle,
        duree_minutes: DUREE_BILAN_MINUTES,
        client: {
          prenom: profil?.prenom ?? null,
          nom: profil?.nom ?? null,
          telephone: profil?.telephone ?? null,
          email: emails.get(user_id) ?? null,
        },
      }
    })
  )
})

export default router
