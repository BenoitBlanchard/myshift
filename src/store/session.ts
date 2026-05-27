'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  Mission,
  Pause,
  PauseSchedule,
  ProductionSnapshot,
  Profile,
  ProductivityStats,
  WorkSession,
} from '@/types'
import { calcStats } from '@/lib/productivity'

interface SessionStore {
  session: WorkSession | null
  missions: Mission[]
  pauses: Pause[]
  snapshots: ProductionSnapshot[]
  pauseSchedules: PauseSchedule[]
  profile: Profile | null
  now: Date
  stats: ProductivityStats | null

  // Derived helpers
  activeMission: Mission | null
  activePause: Pause | null

  setData: (data: {
    session: WorkSession | null
    missions: Mission[]
    pauses: Pause[]
    snapshots: ProductionSnapshot[]
    pauseSchedules: PauseSchedule[]
    profile: Profile
  }) => void

  updateSession: (updates: Partial<WorkSession>) => void
  addMission: (mission: Mission) => void
  updateMission: (id: string, updates: Partial<Mission>) => void
  addPause: (pause: Pause) => void
  updatePause: (id: string, updates: Partial<Pause>) => void
  addSnapshot: (snapshot: ProductionSnapshot) => void
  tick: () => void
  reset: () => void
}

function deriveActiveMission(missions: Mission[]): Mission | null {
  return missions.find(m => m.started_at && !m.ended_at) ?? null
}

function deriveActivePause(pauses: Pause[]): Pause | null {
  return pauses.find(p => !p.ended_at) ?? null
}

function recomputeStats(
  session: WorkSession | null,
  missions: Mission[],
  pauses: Pause[],
  snapshots: ProductionSnapshot[],
  profile: Profile | null,
  now: Date
): ProductivityStats | null {
  if (!session || !profile) return null
  return calcStats(session, missions, pauses, snapshots, profile.target_lph, now)
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      session: null,
      missions: [],
      pauses: [],
      snapshots: [],
      pauseSchedules: [],
      profile: null,
      now: new Date(),
      stats: null,
      activeMission: null,
      activePause: null,

      setData({ session, missions, pauses, snapshots, pauseSchedules, profile }) {
        const now = new Date()
        set({
          session,
          missions,
          pauses,
          snapshots,
          pauseSchedules,
          profile,
          now,
          activeMission: deriveActiveMission(missions),
          activePause: deriveActivePause(pauses),
          stats: recomputeStats(session, missions, pauses, snapshots, profile, now),
        })
      },

      updateSession(updates) {
        const session = get().session
        if (!session) return
        const updated = { ...session, ...updates }
        const { missions, pauses, snapshots, profile, now } = get()
        set({
          session: updated,
          stats: recomputeStats(updated, missions, pauses, snapshots, profile, now),
        })
      },

      addMission(mission) {
        const missions = [...get().missions, mission]
        const { session, pauses, snapshots, profile, now } = get()
        set({
          missions,
          activeMission: deriveActiveMission(missions),
          stats: recomputeStats(session, missions, pauses, snapshots, profile, now),
        })
      },

      updateMission(id, updates) {
        const missions = get().missions.map(m => m.id === id ? { ...m, ...updates } : m)
        const { session, pauses, snapshots, profile, now } = get()
        set({
          missions,
          activeMission: deriveActiveMission(missions),
          stats: recomputeStats(session, missions, pauses, snapshots, profile, now),
        })
      },

      addPause(pause) {
        const pauses = [...get().pauses, pause]
        const { session, missions, snapshots, profile, now } = get()
        set({
          pauses,
          activePause: deriveActivePause(pauses),
          stats: recomputeStats(session, missions, pauses, snapshots, profile, now),
        })
      },

      updatePause(id, updates) {
        const pauses = get().pauses.map(p => p.id === id ? { ...p, ...updates } : p)
        const { session, missions, snapshots, profile, now } = get()
        set({
          pauses,
          activePause: deriveActivePause(pauses),
          stats: recomputeStats(session, missions, pauses, snapshots, profile, now),
        })
      },

      addSnapshot(snapshot) {
        const snapshots = [...get().snapshots, snapshot]
        const { session, missions, pauses, profile, now } = get()
        set({
          snapshots,
          stats: recomputeStats(session, missions, pauses, snapshots, profile, now),
        })
      },

      tick() {
        const now = new Date()
        const { session, missions, pauses, snapshots, profile } = get()
        set({
          now,
          stats: recomputeStats(session, missions, pauses, snapshots, profile, now),
        })
      },

      reset() {
        set({
          session: null,
          missions: [],
          pauses: [],
          snapshots: [],
          pauseSchedules: [],
          now: new Date(),
          stats: null,
          activeMission: null,
          activePause: null,
        })
      },
    }),
    {
      name: 'myshift-session',
      partialize: state => ({
        session: state.session,
        missions: state.missions,
        pauses: state.pauses,
        snapshots: state.snapshots,
        pauseSchedules: state.pauseSchedules,
        profile: state.profile,
      }),
    }
  )
)
