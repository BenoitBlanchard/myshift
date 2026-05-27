'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PinInput } from '@/components/ui/PinInput'

export default function SetupPage() {
  const router = useRouter()
  const [pseudo, setPseudo] = useState('')
  const [pin, setPin] = useState('')
  const [step, setStep] = useState<'pseudo' | 'pin'>('pseudo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSetup(currentPin: string) {
    if (currentPin.length !== 4) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo, pin: currentPin }),
    })
    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erreur lors de la configuration')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 gap-8">
      <div className="flex flex-col items-center gap-2">
        <span className="text-4xl font-black tracking-tight text-white">MyShift</span>
        <span className="text-purple-400 text-sm font-medium">Première configuration</span>
      </div>

      {done ? (
        <div className="text-center flex flex-col gap-3">
          <p className="text-green-400 text-2xl font-bold">✓ Compte admin créé</p>
          <p className="text-gray-400 text-sm">Redirection vers la connexion…</p>
        </div>
      ) : step === 'pseudo' ? (
        <form
          onSubmit={e => { e.preventDefault(); if (pseudo.trim()) setStep('pin') }}
          className="w-full max-w-xs flex flex-col gap-4"
        >
          <div className="bg-amber-900/20 border border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-300">
            Cette page crée le compte administrateur. Accessible une seule fois.
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-gray-400 text-sm font-medium">Pseudo admin</span>
            <input
              type="text"
              value={pseudo}
              onChange={e => setPseudo(e.target.value)}
              placeholder="Ex: admin"
              autoFocus
              className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-4 text-white text-xl font-semibold text-center focus:outline-none focus:border-purple-500"
            />
          </label>
          <button
            type="submit"
            disabled={!pseudo.trim()}
            className="py-4 rounded-2xl bg-purple-700 text-white font-bold text-lg hover:bg-purple-600 disabled:opacity-40 transition-colors"
          >
            Continuer
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-5 w-full max-w-xs">
          <div className="text-center">
            <p className="text-gray-300 font-medium">Compte : <span className="text-white font-bold">{pseudo}</span></p>
            <p className="text-gray-500 text-sm">Choisis un PIN à 4 chiffres</p>
          </div>
          <PinInput
            value={pin}
            onChange={p => {
              setPin(p)
              if (p.length === 4) handleSetup(p)
            }}
          />
          {loading && <p className="text-gray-400 text-sm animate-pulse">Création en cours…</p>}
          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-2 text-center">
              {error}
            </p>
          )}
          <button
            onClick={() => { setStep('pseudo'); setPin(''); setError('') }}
            className="text-gray-500 text-sm hover:text-gray-300"
          >
            ← Retour
          </button>
        </div>
      )}
    </div>
  )
}
