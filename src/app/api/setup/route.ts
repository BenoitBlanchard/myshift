import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fakeEmail } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()

  // Vérifier qu'aucun admin n'existe
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (admins && admins.length > 0) {
    return NextResponse.json({ error: 'Un admin existe déjà' }, { status: 403 })
  }

  const { pseudo, pin } = await request.json()

  if (!pseudo || !pin || pin.length < 4) {
    return NextResponse.json({ error: 'Pseudo et mot de passe (min. 4 caractères) requis' }, { status: 400 })
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: fakeEmail(pseudo),
    password: pin,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { pseudo },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from('profiles')
    .upsert({ id: data.user.id, pseudo, role: 'admin', target_lph: 80 })

  await supabase.rpc('create_default_pause_schedules', { p_user_id: data.user.id })

  return NextResponse.json({ ok: true })
}
