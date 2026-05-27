import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/demo'

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pin } = await request.json()
  if (!pin || pin.length < 4) {
    return NextResponse.json({ error: 'Mot de passe invalide (min. 4 caractères)' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { error } = await service.auth.admin.updateUserById(user.id, { password: pin })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
