import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return !!url && !url.includes('your-project')
}

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // Supprimer le cookie démo dans tous les cas
  res.cookies.delete('myshift_demo')

  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  return res
}
