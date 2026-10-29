import express from 'express'
import cors from 'cors'
import authRouter from './routes/auth.js'
import profilRouter from './routes/profil.js'
import rdvRouter from './routes/rdv.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/profil', profilRouter)
app.use('/api/rdv', rdvRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, (error) => {
  if (error) throw error
  console.log(`API sur http://localhost:${PORT}`)
})
