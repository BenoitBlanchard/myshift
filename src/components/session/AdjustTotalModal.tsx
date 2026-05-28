'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

interface AdjustTotalModalProps {
  currentTotal: number
  currentAdjustment: number
  onSave: (newTotal: number) => void
  onClose: () => void
  loading?: boolean
}

export function AdjustTotalModal({ currentTotal, currentAdjustment, onSave, onClose, loading }: AdjustTotalModalProps) {
  const [value, setValue] = useState(currentTotal)
  const [editing, setEditing] = useState(false)
  const [editStr, setEditStr] = useState(String(currentTotal))

  const baseTotal = currentTotal - currentAdjustment
  const delta = value - currentTotal
  const newAdjustment = value - baseTotal

  function commitEdit() {
    const n = parseInt(editStr)
    if (!isNaN(n) && n >= 0) setValue(n)
    setEditing(false)
  }

  return (
    <Modal title="Ajuster les lignes finales" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-xs text-zinc-500 leading-relaxed">
          Corrige le total sans toucher aux missions. La différence apparaît comme une régule dans le récap.
        </p>

        {/* Stepper */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setValue(v => Math.max(0, v - 1))}
            disabled={value <= 0}
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
              className="flex-1 bg-zinc-800/60 border-2 border-zinc-400/50 rounded-2xl px-4 py-3 text-white text-center text-4xl font-bold focus:outline-none transition-all tabular-nums"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setEditStr(String(value)); setEditing(true) }}
              className="flex-1 bg-zinc-800/60 border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-center text-4xl font-bold hover:border-white/20 active:scale-[0.97] transition-all tabular-nums"
            >
              {value}
            </button>
          )}

          <button
            type="button"
            onClick={() => setValue(v => v + 1)}
            className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-white/[0.08] text-3xl font-bold text-zinc-300 hover:bg-zinc-700/70 active:scale-[0.94] transition-all flex-shrink-0"
          >
            +
          </button>
        </div>

        {/* Feedback */}
        <div className="flex flex-col gap-1 text-center">
          {delta !== 0 && (
            <p className={`text-sm font-semibold ${delta > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {delta > 0 ? '+' : ''}{delta} lignes depuis le total actuel
            </p>
          )}
          {newAdjustment !== 0 ? (
            <p className={`text-xs ${newAdjustment > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              Régule totale : {newAdjustment > 0 ? '+' : ''}{newAdjustment} lig.
            </p>
          ) : (
            <p className="text-xs text-zinc-600">Aucune régule</p>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-4 rounded-2xl bg-zinc-800/60 text-zinc-300 font-semibold border border-white/[0.08] hover:bg-zinc-700/70 active:scale-[0.97] transition-all"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSave(value)}
            disabled={delta === 0 || loading}
            className="py-4 rounded-2xl bg-gradient-to-b from-blue-500 to-blue-700 text-white font-semibold border border-blue-400/20 shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:from-blue-400 hover:to-blue-600 disabled:opacity-40 active:scale-[0.97] transition-all"
          >
            {loading ? '…' : 'Valider'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
