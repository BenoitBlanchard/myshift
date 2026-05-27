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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-zinc-800 pb-safe">
      <div className="flex">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
                active ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
              <span>{label}</span>
              {active && <span className="absolute bottom-0 w-6 h-0.5 bg-blue-500 rounded-full" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
