'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Save, Plus, Trash2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { PinInput } from '@/components/ui/PinInput'
import { Modal } from '@/components/ui/Modal'
import { Profile, PauseSchedule } from '@/types'
import { useSessionStore } from '@/store/session'

export default function ProfilePage() {
  const router = useRouter()
  const { reset } = useSessionStore()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [schedules, setSchedules] = useState<PauseSchedule[]>([])
  const [targetLph, setTargetLph] = useState(80)
  const [showPinModal, setShowPinModal] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStep, setPinStep] = useState<'new' | 'confirm'>('new')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [profileRes, schedulesRes] = await Promise.all([
      fetch('/api/profile'),
      fetch('/api/pause-schedules'),
    ])
    const p = await profileRes.json()
    const s = await schedulesRes.json()
    setProfile(p)
    setTargetLph(p?.target_lph ?? 80)
    setSchedules(s ?? [])
    setLoading(false)
  }

  async function saveObjectif() {
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_lph: targetLph }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleChangePin() {
    if (newPin !== confirmPin) {
      alert('Les PINs ne correspondent pas')
      return
    }
    setSaving(true)
    await fetch('/api/profile/pin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    })
    setSaving(false)
    setShowPinModal(false)
    setNewPin('')
    setConfirmPin('')
    setPinStep('new')
  }

  async function deleteSchedule(id: string) {
    await fetch(`/api/pause-schedules/${id}`, { method: 'DELETE' })
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  async function addSchedule() {
    const name = prompt('Nom de la pause (ex: Pause 14h00)')
    if (!name) return
    const time = prompt('Heure (ex: 14:00)')
    if (!time) return
    const duration = parseInt(prompt('Durée en minutes') ?? '10')
    const deducted = confirm('Décomptée par Magellan/système ?')

    const res = await fetch('/api/pause-schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        scheduled_time: `${time}:00`,
        duration_minutes: duration,
        is_system_deducted: deducted,
        order_index: schedules.length + 1,
      }),
    })
    const newSchedule = await res.json()
    setSchedules(prev => [...prev, newSchedule])
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    reset()
    router.push('/login')
  }

  return (
    <>
      <TopBar title="Mon profil" />

      <main className="px-4 pt-4 pb-4 flex flex-col gap-4 max-w-lg mx-auto">
        {loading ? (
          <div className="h-32 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
        ) : (
          <>
            {/* Identité */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-2">Compte</p>
              <p className="text-2xl font-bold text-white">{profile?.pseudo}</p>
              <p className="text-sm text-zinc-500 mt-1">
                {profile?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
              </p>
            </div>

            {/* Objectif */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Objectif productivité</p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={targetLph}
                  onChange={e => setTargetLph(parseInt(e.target.value) || 0)}
                  className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3 text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent transition-all"
                />
                <span className="text-zinc-400 text-base font-medium">lignes / heure</span>
              </div>
              <button
                onClick={saveObjectif}
                disabled={saving}
                className={`flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-colors ${
                  saved
                    ? 'bg-emerald-700 text-white border border-emerald-600/50'
                    : 'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/30'
                }`}
              >
                <Save size={16} />
                {saved ? 'Sauvegardé ✓' : saving ? '…' : 'Sauvegarder'}
              </button>
            </div>

            {/* Pauses planifiées */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Pauses planifiées</p>
                <button
                  onClick={addSchedule}
                  className="flex items-center gap-1 text-blue-400 text-xs font-medium hover:text-blue-300 transition-colors"
                >
                  <Plus size={14} /> Ajouter
                </button>
              </div>
              {schedules.length === 0 ? (
                <p className="text-zinc-600 text-sm text-center py-2">Aucune pause planifiée</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {schedules
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(s => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2.5"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">{s.name}</p>
                          <p className="text-zinc-500 text-xs mt-0.5">
                            {s.scheduled_time.slice(0, 5)} · {s.duration_minutes}min ·{' '}
                            {s.is_system_deducted
                              ? <span className="text-amber-400">décomptée Magellan</span>
                              : 'non décomptée'}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteSchedule(s.id)}
                          className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* PIN */}
            <button
              onClick={() => setShowPinModal(true)}
              className="w-full py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold text-sm hover:bg-zinc-800 transition-colors"
            >
              Changer mon PIN
            </button>

            {/* Admin link */}
            {profile?.role === 'admin' && (
              <a
                href="/admin/users"
                className="w-full py-3.5 rounded-xl bg-purple-950/30 border border-purple-800/50 text-purple-300 font-semibold text-sm text-center block hover:bg-purple-950/50 transition-colors"
              >
                Panel Admin — Gestion des comptes
              </a>
            )}

            {/* Déconnexion */}
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-red-950/20 border border-red-900/40 text-red-400 font-semibold text-sm hover:bg-red-950/40 transition-colors"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>
          </>
        )}
      </main>

      {showPinModal && (
        <Modal title={pinStep === 'new' ? 'Nouveau PIN' : 'Confirmer le PIN'} onClose={() => {
          setShowPinModal(false)
          setNewPin('')
          setConfirmPin('')
          setPinStep('new')
        }}>
          <div className="flex flex-col gap-5">
            {pinStep === 'new' ? (
              <>
                <p className="text-sm text-zinc-400 text-center">Entre ton nouveau PIN à 4 chiffres</p>
                <PinInput
                  value={newPin}
                  onChange={p => {
                    setNewPin(p)
                    if (p.length === 4) setPinStep('confirm')
                  }}
                />
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-400 text-center">Confirme ton nouveau PIN</p>
                <PinInput
                  value={confirmPin}
                  onChange={p => {
                    setConfirmPin(p)
                    if (p.length === 4) {
                      if (p !== newPin) {
                        alert('PINs différents, recommence')
                        setConfirmPin('')
                        setPinStep('new')
                        setNewPin('')
                      }
                    }
                  }}
                />
                {confirmPin.length === 4 && confirmPin === newPin && (
                  <button
                    onClick={handleChangePin}
                    disabled={saving}
                    className="py-3.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {saving ? '…' : 'Valider'}
                  </button>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
