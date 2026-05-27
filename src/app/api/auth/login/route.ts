import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fakeEmail } from '@/lib/utils'

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return !!url && !url.includes('your-project')
}

export async function POST(request: NextRequest) {
  const { pseudo, pin } = await request.json()

  if (!pseudo || !pin) {
    return NextResponse.json({ error: 'Pseudo et mot de passe requis' }, { status: 400 })
  }

  // ── Mode démo ──────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    const res = NextResponse.json({ ok: true, demo: true })
    res.cookies.set('myshift_demo', JSON.stringify({ pseudo, role: 'admin', target_lph: 80 }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
    })
    return res
  }

  // ── Mode normal ────────────────────────────────────────
  try {
    const service = await createServiceClient()
    const { data: profile } = await service
      .from('profiles')
      .select('supabase_email')
      .eq('pseudo', pseudo)
      .maybeSingle()

    const authEmail = profile?.supabase_email ?? fakeEmail(pseudo)

    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: pin,
    })

    if (error) {
      return NextResponse.json({ error: 'Pseudo ou mot de passe incorrect' }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ error: 'Erreur serveur, réessaie.' }, { status: 500 })
  }
}
