import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fakeEmail } from '@/lib/utils'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return null
  }
  return user
}

// Lister les utilisateurs
export async function GET() {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Créer un utilisateur
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { pseudo, pin } = await request.json()
  if (!pseudo || !pin || pin.length < 4) {
    return NextResponse.json({ error: 'Pseudo et mot de passe (min. 4 caractères) requis' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data, error } = await service.auth.admin.createUser({
    email: fakeEmail(pseudo),
    password: pin,
    email_confirm: true,
    app_metadata: { role: 'user' },
    user_metadata: { pseudo },
  })

  if (error) {
    if (error.message.includes('already')) {
      return NextResponse.json({ error: 'Ce pseudo existe déjà' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Le trigger crée le profil mais on s'assure du pseudo correct
  await service.from('profiles').upsert({
    id: data.user.id,
    pseudo,
    role: 'user',
    target_lph: 80,
  })

  // Pauses par défaut
  await service.rpc('create_default_pause_schedules', { p_user_id: data.user.id })

  return NextResponse.json({ ok: true })
}

// Supprimer ou réinitialiser PIN
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, newPin } = await request.json()
  if (!userId || !newPin || newPin.length !== 4) {
    return NextResponse.json({ error: 'userId et newPin requis' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { error } = await service.auth.admin.updateUserById(userId, { password: newPin })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  if (!await requireAdmin(supabase)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId requis' }, { status: 400 })

  const service = await createServiceClient()
  const { error } = await service.auth.admin.deleteUser(userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
