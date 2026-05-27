'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { Profile } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { PinInput } from '@/components/ui/PinInput'
import { formatDate } from '@/lib/utils'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showResetPin, setShowResetPin] = useState<Profile | null>(null)
  const [newPseudo, setNewPseudo] = useState('')
  const [newPin, setNewPin] = useState('')
  const [resetPin, setResetPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data ?? [])
    setLoading(false)
  }

  async function createUser() {
    if (!newPseudo.trim() || newPin.length !== 4) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pseudo: newPseudo.trim(), pin: newPin }),
    })
    if (res.ok) {
      setShowCreate(false)
      setNewPseudo('')
      setNewPin('')
      await loadUsers()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erreur création')
    }
    setSaving(false)
  }

  async function deleteUser(user: Profile) {
    if (!confirm(`Supprimer le compte de ${user.pseudo} ? Cette action est irréversible.`)) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    await loadUsers()
  }

  async function handleResetPin() {
    if (!showResetPin || resetPin.length !== 4) return
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: showResetPin.id, newPin: resetPin }),
    })
    setSaving(false)
    setShowResetPin(null)
    setResetPin('')
  }

  const regularUsers = users.filter(u => u.role !== 'admin')
  const admins = users.filter(u => u.role === 'admin')

  return (
    <main className="px-4 pt-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-zinc-500 text-sm">{regularUsers.length} utilisateur{regularUsers.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus size={16} />
          Créer un compte
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-900 rounded-xl border border-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Admins */}
          {admins.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] text-purple-400 uppercase tracking-widest font-semibold">Administrateurs</p>
              {admins.map(u => (
                <div key={u.id} className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-purple-200">{u.pseudo}</p>
                    <p className="text-xs text-purple-400/70 mt-0.5">Admin · depuis le {formatDate(u.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Utilisateurs */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Utilisateurs</p>
            {regularUsers.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500 text-sm">
                Aucun utilisateur. Crée le premier compte.
              </div>
            ) : (
              regularUsers.map(u => (
                <div key={u.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white text-sm">{u.pseudo}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Objectif {u.target_lph} l/h · depuis le {formatDate(u.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setShowResetPin(u); setResetPin('') }}
                      className="p-2 text-zinc-500 hover:text-blue-400 transition-colors"
                      title="Réinitialiser le PIN"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      onClick={() => deleteUser(u)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Créer utilisateur */}
      {showCreate && (
        <Modal title="Créer un compte" onClose={() => { setShowCreate(false); setNewPseudo(''); setNewPin(''); setError('') }}>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Pseudo</span>
              <input
                type="text"
                value={newPseudo}
                onChange={e => setNewPseudo(e.target.value)}
                placeholder="Pseudo de l'utilisateur"
                autoFocus
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-lg text-center focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-400 uppercase tracking-wider">PIN initial (4 chiffres)</span>
              <PinInput value={newPin} onChange={setNewPin} />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            <button
              onClick={createUser}
              disabled={!newPseudo.trim() || newPin.length !== 4 || saving}
              className="py-3.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors"
            >
              {saving ? '…' : 'Créer le compte'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reset PIN */}
      {showResetPin && (
        <Modal title={`Réinitialiser le PIN de ${showResetPin.pseudo}`} onClose={() => { setShowResetPin(null); setResetPin('') }}>
          <div className="flex flex-col gap-5">
            <p className="text-sm text-zinc-400 text-center">Nouveau PIN à 4 chiffres</p>
            <PinInput value={resetPin} onChange={setResetPin} />
            {resetPin.length === 4 && (
              <button
                onClick={handleResetPin}
                disabled={saving}
                className="py-3.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {saving ? '…' : 'Valider'}
              </button>
            )}
          </div>
        </Modal>
      )}
    </main>
  )
}
