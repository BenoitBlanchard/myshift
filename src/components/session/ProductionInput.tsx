'use client'

import { useState } from 'react'
import { ProductivityStats } from '@/types'

interface ProductionInputProps {
  currentLines: number | null
  maxLines: number
  stats: ProductivityStats | null
  onSubmit: (totalLines: number, remainingLines: number | null) => void
  onCancel: () => void
  loading?: boolean
}

export function ProductionInput({ currentLines, maxLines, stats, onSubmit, onCancel, loading }: ProductionInputProps) {
  const min = currentLines ?? 0
  const max = maxLines > 0 ? maxLines : 9999

  const [value, setValue] = useState(min)
  const [editing, setEditing] = useState(false)
  const [editStr, setEditStr] = useState(String(min))
  const [remaining, setRemaining] = useState('')

  const remainingNum = remaining ? parseInt(remaining) : null
  const delta = value - min

  const diffLines = stats?.diffLinesTotal ?? null
  const avanceRetard = diffLines !== null && stats?.totalFinalLines != null
    ? Math.round(value - (stats.totalFinalLines - diffLines))
    : null

  function clamp(n: number) {
    return Math.max(min, Math.min(max, n))
  }

  function commitEdit() {
    const n = parseInt(editStr)
    if (!isNaN(n)) setValue(clamp(n))
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Contrôle principal */}
      <div className="flex flex-col gap-3">
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

        {/* +/- */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setValue(v => Math.max(min, v - 1))}
            disabled={value <= min}
            className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-white/[0.08] text-3xl font-bold text-zinc-300 hover:bg-zinc-700/70 active:scale-[0.94] disabled:opacity-25 transition-all flex-shrink-0"
          >
            −
          </button>

          {editing ? (
            <input
              type="number"
              inputMode="numeric"
              value={editStr}
              onChange={e => setEditStr(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => e.key === 'Enter' && commitEdit()}
              autoFocus
              className="flex-1 bg-zinc-800/60 border-2 border-zinc-400/50 rounded-2xl px-4 py-3 text-white text-center text-4xl font-bold focus:outline-none transition-all"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setEditStr(String(value)); setEditing(true) }}
              className="flex-1 bg-zinc-800/60 border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-center text-4xl font-bold hover:border-white/20 active:scale-[0.97] transition-all"
            >
              {value}
            </button>
          )}

          <button
            type="button"
            onClick={() => setValue(v => Math.min(max, v + 1))}
            disabled={value >= max}
            className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-white/[0.08] text-3xl font-bold text-zinc-300 hover:bg-zinc-700/70 active:scale-[0.94] disabled:opacity-25 transition-all flex-shrink-0"
          >
            +
          </button>
        </div>

        {/* Feedback delta / objectif */}
        {delta > 0 && (
          <p className="text-sm font-medium text-center text-emerald-400">
            +{delta} lignes depuis la dernière saisie
          </p>
        )}
        {delta === 0 && currentLines !== null && (
          <p className="text-sm text-center text-zinc-600">Aucune ligne ajoutée</p>
        )}
        {avanceRetard !== null && (
          <p className={`text-sm font-medium text-center ${avanceRetard >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {avanceRetard >= 0
              ? `+${avanceRetard} lignes d'avance sur l'objectif`
              : `${avanceRetard} lignes de retard sur l'objectif`}
          </p>
        )}
      </div>

      {/* Séparateur multi-prise */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">multi-prise</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      {/* Lignes restantes optionnel */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
          Lignes restantes sur la commande{' '}
          <span className="text-zinc-600 normal-case font-normal">(optionnel)</span>
        </p>
        <p className="text-xs text-zinc-600">
          Multi-clients : corrige le total réel de la mission.
        </p>
        <input
          type="number"
          inputMode="numeric"
          value={remaining}
          onChange={e => setRemaining(e.target.value)}
          placeholder="ex: 80"
          className="w-full bg-zinc-800/60 border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-center text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all"
        />
        {remainingNum !== null && delta > 0 && (
          <p className="text-xs text-zinc-500 text-center">
            Total mission recalculé :{' '}
            <span className="text-zinc-300 font-semibold">{delta + remainingNum} lignes</span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="py-4 rounded-2xl bg-zinc-800/60 text-zinc-300 font-semibold border border-white/[0.08] hover:bg-zinc-700/70 active:scale-[0.97] transition-all"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => value > min && onSubmit(value, remainingNum)}
          disabled={value <= min || loading}
          className="py-4 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-white font-semibold border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:from-blue-400 hover:to-blue-600 disabled:opacity-40 active:scale-[0.97] transition-all"
        >
          {loading ? '…' : 'Valider'}
        </button>
      </div>
    </div>
  )
}
