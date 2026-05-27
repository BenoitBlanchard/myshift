'use client'

import { useState } from 'react'
import { MissionFormData, SupportType } from '@/types'
import { cn } from '@/lib/utils'
import { formatDeadTime } from '@/lib/productivity'

interface MissionFormProps {
  missionNumber: number
  deadTimeMs?: number | null
  onSubmit: (data: MissionFormData) => void
  onCancel: () => void
  loading?: boolean
}

function SupportRow({
  index,
  type,
  label,
  onChange,
}: {
  index: number
  type: SupportType
  label: string
  onChange: (field: string, val: number | undefined) => void
}) {
  return (
    <div className="bg-zinc-800/50 rounded-xl p-3 flex flex-col gap-2 border border-zinc-700/50">
      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Lignes pad</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="0"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all"
            onChange={e => onChange('pad_lines', e.target.value ? parseInt(e.target.value) : 0)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Poids (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="0"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-white text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all"
            onChange={e => onChange('weight_kg', e.target.value ? parseFloat(e.target.value) : 0)}
          />
        </label>
      </div>
    </div>
  )
}

export function MissionForm({ missionNumber, deadTimeMs, onSubmit, onCancel, loading }: MissionFormProps) {
  const [type, setType] = useState<SupportType>('role')
  const [count, setCount] = useState(1)
  const [supports, setSupports] = useState<Array<{
    pad_lines: number
    weight_kg: number
  }>>(Array.from({ length: 3 }, () => ({ pad_lines: 0, weight_kg: 0 })))

  function updateSupport(idx: number, field: string, val: number | undefined) {
    setSupports(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: val }
      return next
    })
  }

  function getSupportLabel(i: number): string {
    if (type === 'role') return `Rôle ${['A', 'B', 'C'][i]}`
    return `Palette ${i + 1}`
  }

  function handleSubmit() {
    const activeSupports = supports.slice(0, count)
    onSubmit({
      support_type: type,
      support_count: count,
      supports: activeSupports.map((s, i) => ({
        label: getSupportLabel(i),
        pad_lines: s.pad_lines,
        weight_kg: s.weight_kg,
      })),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 font-medium">Mission #{missionNumber}</p>
        {deadTimeMs != null && (
          <div className="flex items-center gap-1.5 bg-amber-950/50 border border-amber-800/50 rounded-lg px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400 text-xs font-mono font-semibold tabular-nums">
              {formatDeadTime(deadTimeMs)}
            </span>
            <span className="text-amber-600 text-[10px]">mort</span>
          </div>
        )}
      </div>

      {/* Type */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Type de support</p>
        <div className="grid grid-cols-2 gap-2">
          {(['role', 'palette'] as SupportType[]).map(t => (
            <button
              key={t}
              onClick={() => { setType(t); if (t === 'palette' && count > 2) setCount(2) }}
              className={cn(
                'py-3 rounded-xl font-semibold text-base transition-colors border',
                type === t
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              )}
            >
              {t === 'role' ? 'Rôle' : 'Palette'}
            </button>
          ))}
        </div>
      </div>

      {/* Nombre de supports */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Nombre de supports</p>
        <div className="flex gap-2">
          {[1, 2, type === 'role' ? 3 : null].filter(Boolean).map(n => (
            <button
              key={n}
              onClick={() => setCount(n as number)}
              className={cn(
                'flex-1 py-3 rounded-xl font-bold text-xl transition-colors border',
                count === n
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Supports */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <SupportRow
            key={i}
            index={i}
            type={type}
            label={getSupportLabel(i)}
            onChange={(field, val) => updateSupport(i, field, val)}
          />
        ))}
      </div>

      {/* Boutons */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button
          onClick={onCancel}
          className="py-4 rounded-xl bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700 hover:bg-zinc-700 transition-colors"
        >
          Annuler
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="py-4 rounded-xl bg-emerald-700 text-white font-semibold border border-emerald-600/50 hover:bg-emerald-600 disabled:opacity-40 transition-colors"
        >
          {loading ? '…' : 'Démarrer'}
        </button>
      </div>
    </div>
  )
}
