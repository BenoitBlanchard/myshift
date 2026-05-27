'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pseudo.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: pseudo.trim(), pin: password }),
      })

      let data: { error?: string } = {}
      try { data = await res.json() } catch { /* réponse non-JSON */ }

      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(data.error ?? `Erreur serveur (${res.status})`)
        setPassword('')
      }
    } catch {
      setError('Impossible de contacter le serveur. Vérifie ta connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs flex flex-col gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <span className="text-4xl font-black tracking-tight text-white">MyShift</span>
          <span className="text-zinc-500 text-sm">Suivi de productivité</span>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4 shadow-xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Pseudo</span>
              <input
                type="text"
                value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                placeholder="Ton pseudo"
                autoFocus
                autoComplete="username"
                inputMode="text"
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3.5 text-white text-xl font-semibold text-center focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all placeholder:text-zinc-600"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Mot de passe / PIN</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••"
                  autoComplete="current-password"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3.5 pr-12 text-white text-xl font-semibold text-center focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/50 border border-red-800/50 rounded-lg px-4 py-3 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!pseudo.trim() || !password || loading}
              className="py-3.5 rounded-lg bg-blue-600 text-white font-semibold text-base hover:bg-blue-500 disabled:opacity-40 transition-colors mt-1"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <a href="/setup" className="text-zinc-700 text-xs text-center hover:text-zinc-500 transition-colors">
          Première utilisation ?
        </a>
      </div>
    </div>
  )
}
