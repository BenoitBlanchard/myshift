'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md sm:block hidden" onClick={onClose} />
      <div className="relative z-10 w-full h-full sm:h-auto sm:max-w-md bg-zinc-900 sm:bg-zinc-900/95 sm:backdrop-blur-2xl sm:rounded-2xl border-0 sm:border sm:border-white/[0.08] px-6 pt-14 pb-8 sm:pt-6 sm:pb-6 overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
