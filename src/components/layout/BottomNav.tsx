'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, Clock, History, Download, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard', icon: BarChart2, label: 'Stats' },
  { href: '/session', icon: Clock, label: 'Session' },
  { href: '/history', icon: History, label: 'Historique' },
  { href: '/export', icon: Download, label: 'Export' },
  { href: '/profile', icon: User, label: 'Profil' },
]

export function BottomNav() {
  const path = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
      <div className="mx-3 mb-3 rounded-2xl bg-zinc-900/85 backdrop-blur-2xl border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.6),0_-1px_0_rgba(255,255,255,0.03)_inset] flex overflow-hidden">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 pt-3 pb-2.5 transition-all duration-200',
                active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <div className={cn(
                'flex items-center justify-center w-9 h-6 rounded-lg transition-all duration-200',
                active && 'bg-white/10'
              )}>
                <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
              </div>
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
