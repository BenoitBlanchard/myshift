import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/demo'
import { today } from '@/lib/utils'

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json(null)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today())
    .maybeSingle()

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    // Mode démo : retourner une session factice avec un ID stable
    const body = await request.json()
    return NextResponse.json({
      id: 'demo-session-' + today(),
      user_id: 'demo-user-id',
      date: today(),
      created_at: new Date().toISOString(),
      notes: null,
      ...body,
    })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('work_sessions')
    .upsert({ user_id: user.id, date: today(), ...body }, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    const { id, ...updates } = await request.json()
    return NextResponse.json({
      id,
      user_id: 'demo-user-id',
      date: today(),
      created_at: new Date().toISOString(),
      notes: null,
      ...updates,
    })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await request.json()
  const { data, error } = await supabase
    .from('work_sessions')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
