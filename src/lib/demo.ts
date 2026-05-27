import { cookies } from 'next/headers'
import { Profile } from '@/types'

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return !!url && !url.includes('your-project')
}

export async function getDemoProfile(): Promise<Profile | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('myshift_demo')?.value
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    return {
      id: 'demo-user-id',
      pseudo: data.pseudo ?? 'demo',
      role: data.role ?? 'admin',
      target_lph: data.target_lph ?? 80,
      created_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
