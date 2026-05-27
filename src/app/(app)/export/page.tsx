'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'

export default function ExportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/export?month=${month}&year=${year}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Erreur export')
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

  const monthName = new Date(year, month - 1).toLocaleString('fr-FR', { month: 'long' })
  const years = [now.getFullYear(), now.getFullYear() - 1]

  return (
    <>
      <TopBar title="Export Excel" />

      <main className="px-4 pt-4 pb-4 flex flex-col gap-4 max-w-lg mx-auto">
        <p className="text-sm text-gray-400">
          Télécharge un fichier Excel avec tes stats mensuelles : détail par session, missions, et récapitulatif.
        </p>

        {/* Sélecteur période */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">Mois</label>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                    month === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {new Date(2000, m - 1).toLocaleString('fr-FR', { month: 'short' })}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">Année</label>
            <div className="flex gap-2">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all ${
                    year === y
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-center">
            {error}
          </p>
        )}

        <button
          onClick={handleExport}
          disabled={loading}
          className="flex items-center justify-center gap-3 py-5 rounded-2xl bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-bold text-lg transition-colors"
        >
          <Download size={22} />
          {loading ? 'Génération…' : `Télécharger — ${monthName} ${year}`}
        </button>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-sm text-gray-500">
          <p className="font-medium text-gray-400 mb-2">Le fichier contient :</p>
          <ul className="flex flex-col gap-1 list-disc list-inside">
            <li>Détail de chaque session (horaires, lignes/h, poids)</li>
            <li>Détail de chaque mission (type, supports, durée)</li>
            <li>Statistiques mensuelles (moyennes, totaux, répartition rôles/palettes)</li>
          </ul>
        </div>
      </main>
    </>
  )
}
