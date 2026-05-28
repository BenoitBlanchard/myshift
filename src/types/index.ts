export type UserRole = 'admin' | 'user'
export type SupportType = 'role' | 'palette'

export interface Profile {
  id: string
  pseudo: string
  role: UserRole
  target_lph: number
  created_at: string
}

export interface PauseSchedule {
  id: string
  user_id: string
  name: string
  scheduled_time: string // "HH:MM:SS"
  duration_minutes: number
  is_system_deducted: boolean
  order_index: number
  created_at: string
}

export interface WorkSession {
  id: string
  user_id: string
  date: string // "YYYY-MM-DD"
  arrived_at: string | null
  pad_connected_at: string | null
  pad_disconnected_at: string | null
  left_at: string | null
  notes: string | null
  created_at: string
}

export interface MissionSupport {
  id: string
  mission_id: string
  support_index: number
  label: string
  pad_lines: number
  weight_kg: number
  liters: number | null
  created_at: string
}

export interface Mission {
  id: string
  session_id: string
  user_id: string
  mission_number: number
  support_type: SupportType
  support_count: number
  started_at: string | null
  ended_at: string | null
  total_pad_lines: number
  total_weight_kg: number
  total_liters: number | null
  notes: string | null
  created_at: string
  supports?: MissionSupport[]
}

export interface Pause {
  id: string
  session_id: string
  user_id: string
  started_at: string
  ended_at: string | null
  is_system_deducted: boolean
  schedule_id: string | null
  created_at: string
}

export interface ProductionSnapshot {
  id: string
  session_id: string
  mission_id: string
  user_id: string
  recorded_at: string
  total_final_lines: number
  remaining_command_lines: number | null
  created_at: string
}

export interface ProductivityStats {
  pad: number | null
  theoretical: number | null
  real: number | null
  targetLph: number
  diffLph: number | null
  diffLinesTotal: number | null
  projectedEndTime: Date | null
  projectedRemainingLines: number | null
  cushionLph: number | null
  totalFinalLines: number | null
  hasSnapshot: boolean
  currentDeadTimeMs: number | null
  totalDeadTimeMs: number | null
}

export interface MissionFormData {
  support_type: SupportType
  support_count: number
  supports: Array<{
    label: string
    pad_lines: number
    weight_kg: number
    liters?: number
  }>
}

export interface SessionPageData {
  session: WorkSession | null
  missions: Mission[]
  pauses: Pause[]
  snapshots: ProductionSnapshot[]
  profile: Profile
  pauseSchedules: PauseSchedule[]
}
