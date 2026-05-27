'use client'

import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface BigButtonProps {
  label: string
  sublabel?: string
  icon?: LucideIcon
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'ghost'
  size?: 'md' | 'lg'
  loading?: boolean
  className?: string
}

const variants = {
  primary: 'bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white border border-blue-400/20 shadow-[0_0_24px_rgba(59,130,246,0.3),0_1px_0_rgba(255,255,255,0.15)_inset]',
  success: 'bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white border border-emerald-400/20 shadow-[0_0_24px_rgba(16,185,129,0.25),0_1px_0_rgba(255,255,255,0.12)_inset]',
  warning: 'bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white border border-amber-400/20 shadow-[0_0_24px_rgba(245,158,11,0.25),0_1px_0_rgba(255,255,255,0.12)_inset]',
  danger:  'bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white border border-red-400/20 shadow-[0_0_24px_rgba(239,68,68,0.25),0_1px_0_rgba(255,255,255,0.12)_inset]',
  ghost:   'bg-zinc-800/60 hover:bg-zinc-700/70 text-zinc-100 border border-white/[0.08] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]',
}

export function BigButton({
  label,
  sublabel,
  icon: Icon,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
}: BigButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-2xl font-semibold transition-all duration-150 select-none active:scale-[0.96]',
        size === 'lg' ? 'min-h-[80px] px-6 py-4 text-xl' : 'min-h-[64px] px-4 py-3 text-base',
        variants[variant],
        (disabled || loading) && 'opacity-40 cursor-not-allowed active:scale-100',
        className
      )}
    >
      {Icon && <Icon size={size === 'lg' ? 28 : 22} strokeWidth={2} />}
      <span>{loading ? '…' : label}</span>
      {sublabel && <span className="text-xs font-normal opacity-70">{sublabel}</span>}
    </button>
  )
}
