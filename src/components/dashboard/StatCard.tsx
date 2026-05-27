'use client'

import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  sublabel?: string
  color?: 'green' | 'amber' | 'red' | 'blue' | 'gray'
  size?: 'sm' | 'lg'
}

const colors = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  blue: 'text-blue-400',
  gray: 'text-zinc-400',
}

export function StatCard({ label, value, sublabel, color = 'gray', size = 'sm' }: StatCardProps) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 flex flex-col gap-1.5">
      <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">{label}</span>
      <span className={cn(
        'font-bold tabular-nums leading-none',
        size === 'lg' ? 'text-5xl' : 'text-3xl',
        colors[color]
      )}>
        {value}
      </span>
      {sublabel && <span className="text-[11px] text-zinc-600">{sublabel}</span>}
    </div>
  )
}
