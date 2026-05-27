'use client'

import { useState } from 'react'
import { ProductivityStats } from '@/types'

interface ProductionInputProps {
  currentLines: number | null
  stats: ProductivityStats | null
  onSubmit: (totalLines: number, remainingLines: number | null) => void
  onCancel: () => void
  loading?: boolean
}

export function ProductionInput({ currentLines, stats, onSubmit, onCancel, loading }: ProductionInputProps) {
  const [value, setValue] = useState('')
  const [remaining, setRemaining] = useState('')

  const num = value ? parseInt(value) : null
  const remainingNum = remaining ? parseInt(remaining) : null

  const delta = num !== null && currentLines !== null ? num - currentLines : null

  const diffLines = stats?.diffLinesTotal ?? null
  const avanceRetard = num !== null && diffLines !== null
    ? Math.round(num - (stats!.totalFinalLines! - diffLines))
    : null

  return (
    <div className="flex flex-col gap-5">

      {/* Champ principal — Lignes préparées pad */}
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1">
            Lignes préparées (pad)
          </p>
          <p className="text-xs text-zinc-600">
            Dis "productivité" au pad → entre le chiffre "Lignes Préparées"
          </p>
          {currentLines !== null && (
            <p className="text-xs text-zinc-600 mt-0.5">
              Dernier total connu : <span className="text-zinc-400 font-semibold">{currentLines}</span>
            </p>
          )}
        </div>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="ex: 260"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white text-center text-4xl font-bold focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all"
          autoFocus
        />
        {delta !== null && (
          <p className={`text-sm font-medium text-center ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {delta >= 0 ? '+' : ''}{delta} lignes depuis la dernière saisie
          </p>
        )}
        {avanceRetard !== null && (
          <p className={`text-sm font-medium text-center ${avanceRetard >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {avanceRetard >= 0
              ? `+${avanceRetard} lignes d'avance sur l'objectif`
              : `${avanceRetard} lignes de retard sur l'objectif`}
          </p>
        )}
      </div>

      {/* Séparateur */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">multi-prise</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Champ optionnel — Lignes restantes commande */}
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold mb-1">
            Lignes restantes sur la commande <span className="text-zinc-600 normal-case font-normal">(optionnel)</span>
          </p>
          <p className="text-xs text-zinc-600">
            Pour les rôles multi-clients : entre le nombre de lignes encore à préparer.
            Corrige le total réel de la mission.
          </p>
        </div>
        <input
          type="number"
          inputMode="numeric"
          value={remaining}
          onChange={e => setRemaining(e.target.value)}
          placeholder="ex: 80"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all"
        />
        {num !== null && remainingNum !== null && currentLines !== null && (
          <p className="text-xs text-zinc-500 text-center">
            Total mission recalculé :{' '}
            <span className="text-zinc-300 font-semibold">
              {(num - currentLines) + remainingNum} lignes
            </span>
          </p>
        )}
      </div>

      {/* Boutons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onCancel}
          className="py-4 rounded-xl bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700 hover:bg-zinc-700 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={() => num && num > 0 && onSubmit(num, remainingNum)}
          disabled={!num || num <= 0 || loading}
          className="py-4 rounded-xl bg-blue-600 text-white font-semibold border border-blue-500/30 hover:bg-blue-500 disabled:opacity-40 transition-colors"
        >
          {loading ? '…' : 'Valider'}
        </button>
      </div>
    </div>
  )
}
