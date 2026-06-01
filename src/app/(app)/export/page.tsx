'use client'

import { useState } from 'react'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'

export default function ExportPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isMin = year === 2026 && month === 4
  const isMax = false

  function prev() {
    if (isMin) return
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function next() {
    if (isMax) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  async function handleExport() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/export?month=${month}&year=${year}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Aucune donnée pour cette période')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `myshift-${year}-${String(month).padStart(2, '0')}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  const monthLabel = new Date(year, month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <>
      <TopBar title="Export Excel" />

      <main className="px-4 pt-4 pb-4 flex flex-col gap-5 max-w-lg mx-auto">

        {/* Sélecteur mois */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={isMin}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/60 border border-white/[0.06] text-zinc-400 hover:text-white disabled:opacity-30 active:scale-[0.93] transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-base font-semibold text-white capitalize">{monthLabel}</p>
          <button
            onClick={next}
            disabled={isMax}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/60 border border-white/[0.06] text-zinc-400 hover:text-white disabled:opacity-30 active:scale-[0.93] transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Bouton télécharger */}
        <button
          onClick={handleExport}
          disabled={loading}
          className="flex items-center justify-center gap-3 py-5 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 border border-emerald-400/20 shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:from-emerald-400 hover:to-emerald-600 disabled:opacity-50 text-white font-bold text-lg active:scale-[0.97] transition-all"
        >
          <Download size={22} />
          {loading ? 'Génération…' : `Télécharger — ${monthLabel}`}
        </button>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/40 rounded-2xl px-4 py-3 text-center">
            {error}
          </p>
        )}

        {/* Contenu */}
        <div className="bg-zinc-900/50 border border-white/[0.06] rounded-2xl p-4 text-sm text-zinc-500 flex flex-col gap-1.5">
          <p className="font-medium text-zinc-400 mb-1">Le fichier contient :</p>
          <p>· Sessions — horaires, l/h Réel, temps travaillé/production, temps mort</p>
          <p>· Missions — type, quai, durée, l/h, notes</p>
          <p>· Stats mensuelles — moyennes, totaux, répartition rolls/palettes</p>
        </div>
      </main>
    </>
  )
}
