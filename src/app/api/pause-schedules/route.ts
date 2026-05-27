import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/demo'

const DEMO_SCHEDULES = [
  { id: 'demo-ps-1', user_id: 'demo-user-id', label: 'Pause repas', duration_min: 30, order_index: 1 },
  { id: 'demo-ps-2', user_id: 'demo-user-id', label: 'Pause courte', duration_min: 10, order_index: 2 },
]

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json(DEMO_SCHEDULES)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const { data } = await supabase
    .from('pause_schedules')
    .select('*')
    .eq('user_id', user.id)
    .order('order_index')

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    const body = await request.json()
    return NextResponse.json({ id: `demo-ps-${Date.now()}`, user_id: 'demo-user-id', ...body })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('pause_schedules')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
