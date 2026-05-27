/**
 * Crée le compte admin initial dans Supabase.
 * Usage : node scripts/create-admin.mjs
 *
 * Prérequis : .env.local rempli avec NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Charger .env.local manuellement
const envPath = resolve(__dirname, '../.env.local')
let envContent = ''
try {
  envContent = readFileSync(envPath, 'utf-8')
} catch {
  console.error('❌  .env.local introuvable')
  process.exit(1)
}

const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
)

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || SUPABASE_URL.includes('your-project')) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL non configuré dans .env.local')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes('your-service')) {
  console.error('❌  SUPABASE_SERVICE_ROLE_KEY non configuré dans .env.local')
  process.exit(1)
}

// ── Config ──────────────────────────────────────────────────
const ADMIN_EMAIL    = 'benoit@admin.fr'
const ADMIN_PASSWORD = 'azerty'
const ADMIN_PSEUDO   = 'benoit'
// ────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`\n🔧  Création du compte admin : ${ADMIN_PSEUDO} (${ADMIN_EMAIL})\n`)

  // 1. Vérifier si un admin existe déjà
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, pseudo')
    .eq('role', 'admin')
    .limit(1)

  if (existing && existing.length > 0) {
    console.log(`⚠️   Un admin existe déjà : ${existing[0].pseudo}`)
    console.log('    Supprimez-le depuis le panel Supabase Auth avant de relancer ce script.')
    process.exit(0)
  }

  // 2. Créer l'utilisateur Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { pseudo: ADMIN_PSEUDO },
  })

  if (authError) {
    if (authError.message.includes('already')) {
      console.log('⚠️   Cet email existe déjà dans Supabase Auth.')
      console.log('    Récupération de l\'UUID existant...')
      // Continuer avec l'upsert du profil
    } else {
      console.error('❌  Erreur création Supabase Auth :', authError.message)
      process.exit(1)
    }
  }

  const userId = authData?.user?.id
  if (!userId) {
    console.error('❌  Impossible de récupérer l\'UUID du nouvel utilisateur')
    process.exit(1)
  }

  // 3. Créer/mettre à jour le profil
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      pseudo: ADMIN_PSEUDO,
      role: 'admin',
      target_lph: 80,
      supabase_email: ADMIN_EMAIL,
    }, { onConflict: 'id' })

  if (profileError) {
    console.error('❌  Erreur création profil :', profileError.message)
    process.exit(1)
  }

  // 4. Pauses par défaut
  const { error: pauseError } = await supabase.rpc('create_default_pause_schedules', {
    p_user_id: userId,
  })

  if (pauseError) {
    console.warn('⚠️   Pauses par défaut non créées :', pauseError.message)
  }

  console.log('✅  Compte créé avec succès !\n')
  console.log(`   Pseudo   : ${ADMIN_PSEUDO}`)
  console.log(`   Email    : ${ADMIN_EMAIL}`)
  console.log(`   Password : ${ADMIN_PASSWORD}`)
  console.log(`   UUID     : ${userId}`)
  console.log('\n   Connecte-toi sur /login avec le pseudo "benoit" et le mot de passe "azerty"\n')
}

main().catch(e => {
  console.error('❌ ', e.message)
  process.exit(1)
})
