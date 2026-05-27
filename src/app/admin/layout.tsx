import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 pb-8">
      <header className="bg-purple-950/50 border-b border-purple-900 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-purple-200">Panel Admin</h1>
          <p className="text-xs text-purple-400">MyShift — Gestion des comptes</p>
        </div>
        <a href="/dashboard" className="text-purple-400 text-sm hover:text-purple-300">
          ← App
        </a>
      </header>
      {children}
    </div>
  )
}
