import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/demo'

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json([])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })

  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '30')
  const month = url.searchParams.get('month') // format YYYY-MM

  let query = supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const toDate = new Date(y, m, 0) // last day of month
    const to = `${y}-${String(m).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`
    query = query.gte('date', from).lte('date', to)
  } else {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data ?? [])
}
