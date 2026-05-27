'use client'

import { ProductivityStats } from '@/types'
import { StatCard } from './StatCard'
import { formatDeadTime, formatDuration, formatLph, formatTime } from '@/lib/productivity'

interface StatsGridProps {
  stats: ProductivityStats | null
  isLive?: boolean
}

function lphColorName(lph: number | null, target: number): 'green' | 'amber' | 'red' | 'gray' {
  if (lph === null) return 'gray'
  const r = lph / target
  if (r >= 1.05) return 'green'
  if (r >= 0.95) return 'amber'
  return 'red'
}

function DeadTimeCard({
  current,
  total,
  frozen,
}: {
  current: number | null
  total: number | null
  frozen: boolean
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">Temps mort</span>
        {frozen && (
          <span className="text-[10px] text-zinc-600 font-medium">figé</span>
        )}
      </div>
      <span className="text-3xl font-bold tabular-nums leading-none text-amber-400">
        {current !== null ? formatDeadTime(current) : '—'}
      </span>
      {total !== null && (
        <span className="text-[11px] text-zinc-600">
          Total : {formatDeadTime(total)}
        </span>
      )}
    </div>
  )
}

export function StatsGrid({ stats, isLive }: StatsGridProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {['Pad', 'Théorique', 'Réel', 'Objectif'].map(label => (
          <StatCard key={label} label={label} value="—" color="gray" />
        ))}
      </div>
    )
  }

  const {
    pad, theoretical, real, targetLph,
    diffLph, diffLinesTotal,
    projectedEndTime, projectedRemainingLines,
    cushionLph, totalFinalLines,
    currentDeadTimeMs, totalDeadTimeMs,
  } = stats

  const hasMission = currentDeadTimeMs !== null
  const isFrozen = hasMission && currentDeadTimeMs === totalDeadTimeMs
    ? false
    : hasMission && (totalDeadTimeMs ?? 0) > (currentDeadTimeMs ?? 0)

  // Frozen when an active mission is running (current segment not ticking)
  // We can detect it by checking if total > current (past segments exist and current is frozen)
  // Actually simpler: frozen = active mission exists, which means current < total OR current is the pre-mission gap
  // The store computes this client-side — we just check if stats say mission is active via projectedRemainingLines
  const missionActive = projectedRemainingLines !== null

  if (!totalFinalLines) {
    return (
      <div className="flex flex-col gap-3">
        <DeadTimeCard
          current={currentDeadTimeMs}
          total={totalDeadTimeMs}
          frozen={missionActive}
        />
        {projectedEndTime && (
          <StatCard
            label="Fin mission"
            value={formatTime(projectedEndTime)}
            sublabel={projectedRemainingLines != null ? `~${projectedRemainingLines} lignes restantes (objectif)` : undefined}
            color="blue"
          />
        )}
      </div>
    )
  }

  const diffSign = (diffLph ?? 0) >= 0 ? '+' : ''
  const linesSign = (diffLinesTotal ?? 0) >= 0 ? '+' : ''

  return (
    <div className="flex flex-col gap-3">
      {isLive && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">En direct</span>
        </div>
      )}

      {/* 3 métriques */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Pad"       value={formatLph(pad)}       sublabel="lignes/h" color={lphColorName(pad, targetLph)} />
        <StatCard label="Théorique" value={formatLph(theoretical)} sublabel="lignes/h" color={lphColorName(theoretical, targetLph)} />
        <StatCard label="Réel"      value={formatLph(real)}      sublabel="lignes/h" color={lphColorName(real, targetLph)} />
      </div>

      {/* Écart + projection */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Écart objectif"
          value={diffLph !== null ? `${diffSign}${formatLph(diffLph)}` : '—'}
          sublabel={diffLinesTotal !== null ? `${linesSign}${diffLinesTotal} lignes` : undefined}
          color={diffLph === null ? 'gray' : diffLph >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Fin mission"
          value={formatTime(projectedEndTime)}
          sublabel={projectedRemainingLines != null ? `~${projectedRemainingLines} lignes restantes` : undefined}
          color="blue"
        />
      </div>

      {/* Coussin + temps mort */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="Coussin"
          value={cushionLph !== null ? `${diffSign}${formatLph(cushionLph)} l/h` : '—'}
          sublabel={cushionLph !== null && cushionLph > 0
            ? `Relâcher jusqu'à ${targetLph}l/h`
            : cushionLph !== null && cushionLph < 0
            ? 'Accélère pour l\'objectif'
            : undefined}
          color={cushionLph === null ? 'gray' : cushionLph >= 0 ? 'green' : 'red'}
        />
        <DeadTimeCard
          current={currentDeadTimeMs}
          total={totalDeadTimeMs}
          frozen={missionActive}
        />
      </div>
    </div>
  )
}
