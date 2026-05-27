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

  const { data, error } = await supabase
    .from('work_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data ?? [])
}
