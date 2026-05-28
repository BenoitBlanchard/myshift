# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev server (localhost:3000)
npm run build    # Production build — always run before committing to catch TS errors
npm run lint     # ESLint
```

There are no tests. TypeScript is the main safety net — `npm run build` runs `tsc` as part of the process.

## Architecture

Next.js 16 App Router + Supabase + Zustand. Mobile-first dark UI for warehouse use (gros boutons, thème zinc-950).

### Route groups

- `src/app/(auth)/` — public (login, setup)
- `src/app/(app)/` — protected user pages with bottom nav
- `src/app/admin/` — admin-only (server-side role check in layout)
- `src/app/api/` — API routes (all protected via `supabase.auth.getUser()`)
- `src/proxy.ts` — Next.js 16 proxy (renamed from middleware). Handles auth redirect + admin guard.

### Auth model

No email. Supabase Auth with fake email `{pseudo}@myshift.app` + password (minimum 4 chars, not restricted to digits).

- `fakeEmail()` in `src/lib/utils.ts` strips accents and uses `.app` TLD (Supabase rejects `.internal` and non-ASCII).
- Role stored in `auth.users.app_metadata.role` (NOT in profiles table) — avoids infinite RLS recursion when checking profiles.
- `createServiceClient()` (service role key, server-only) is required for admin operations: creating users, resetting PINs, deleting users.
- `/setup` route creates the first admin account — only works when no admin exists. After that it returns 403.

### Data flow for session page

The session page (`/session`) is the core of the app. All interactions write to Supabase then update the Zustand store:

1. `fetch('/api/...')` → Supabase write
2. `store.addMission()` / `store.updateSession()` / etc. → Zustand update
3. Zustand recomputes `stats` synchronously via `calcStats()`
4. A `setInterval` calls `store.tick()` every second to keep timers live

The store persists to `localStorage` (Zustand `persist` middleware) under key `myshift-session`. This provides offline resilience — data survives page refresh.

### Productivity calculations (`src/lib/productivity.ts`)

Three distinct metrics — all computed from the same data, different time denominators:

| Metric | Time base |
|--------|-----------|
| **Pad** | `(now − pad_connected)` − system-deducted pauses |
| **Théorique** | `(now − pad_connected)` − all pauses (base for prime) |
| **Réel** | `(now − pad_connected)` (aucune pause déduite) |

The three LPH metrics require at least one `production_snapshot`. Before the first injection, they return `null` and the UI shows "—".

**`effectiveTotalLines`** — the true line count used for all productivity metrics:

```
if no snapshot:
  effectiveTotalLines = sum(completed missions' total_pad_lines)

if snapshot exists:
  linesBeforeSnapshot = sum(missions ended BEFORE snapshot)
  missionDuringSnapshot = mission started before AND ended after snapshot
  if missionDuringSnapshot:
    remaining = missionDuringSnapshot.total_pad_lines − (snapshotLines − linesBeforeSnapshot)
    (or snapshot.remaining_command_lines if user entered it manually)
  missionsAfterSnapshot = missions started entirely AFTER snapshot
  effectiveTotalLines = snapshotLines + remaining + sum(missionsAfterSnapshot)
```

Key invariant: **missions are never modified once created**. `total_pad_lines` is set at mission creation and never changed. Adjustments use `remaining_command_lines` on the snapshot (stored as a "régule").

**Mission projection** (`projectedEndTime`, `projectedRemainingLines`) — independent of snapshots, always computed when a mission is active:
- `pace = theoreticalLph ?? targetLph`
- `projectedEndTime = now + remaining / pace`

**Real remaining** shown in the mission card (not theoretical):
- If snapshot taken during active mission: `mission.total_pad_lines − lines_already_counted`
- If `snapshot.remaining_command_lines` set: use that directly
- If no snapshot yet: `mission.total_pad_lines`

**"Régule"**: when the user enters `remaining_command_lines` in the Production modal, it is stored in the snapshot (NOT on the mission). `calcStats` uses it to adjust `effectiveTotalLines`. The recap displays "régule ±N lig." in amber/green.

`calcStats()` is a pure function. Returns `cushionLph`, `diffLinesTotal`, `totalFinalLines`, `projectedEndTime`, `projectedRemainingLines`, dead times.

### Key domain terms

- **Lignes pad** ≠ **Lignes finales**: pad lines = what the mission form shows; final lines = cumulative count given by the pad device when saying "productivité". Only final lines count for productivity.
- **Production snapshot**: user says "productivité" to the pad, gets a cumulative total, enters it manually. Anchor for all productivity calculations. Has optional `remaining_command_lines` field for régule.
- **Support types**: `role` (vertical multi-shelf, up to 3 per mission) vs `palette` (single client, up to 2 per mission).
- **Pause décomptée** (`is_system_deducted: true`): subtracted by the Magellan system from pad time. Only the 16h00 pause (21min) is system-deducted. The 14h00 and 18h00 pauses are not.
- **Régule**: adjustment when `remaining_command_lines` ≠ natural remaining. Shown in the mission recap as "régule −N lig." — never modifies the mission itself.

### UI components

- `src/components/ui/BigButton.tsx` — gradient variants (primary/success/warning/danger/ghost) + `active:scale-[0.96]` micro-interaction
- `src/components/layout/BottomNav.tsx` — floating glass pill nav (backdrop-blur, rounded-2xl, shadow)
- `src/components/dashboard/StatCard.tsx` — colored top border per metric color
- `src/components/ui/Modal.tsx` — full-screen on mobile (pt-14), centered card on desktop (sm:max-w-md)
- `src/hooks/useWakeLock.ts` — prevents screen sleep during active pad session; re-acquires on `visibilitychange`

### Production modal (`ProductionInput`)

- Starts at `stats.totalFinalLines ?? lastSnap.total_final_lines` (effective known total, not just raw snapshot)
- Min = `currentLines` (effective total) — cannot go below what is already recorded
- `remaining_command_lines` (optional): stored in snapshot, creates a régule in recap, **never modifies the mission**

### Supabase clients

- `src/lib/supabase/client.ts` — browser client (Client Components)
- `src/lib/supabase/server.ts` — exports `createClient()` (anon key) and `createServiceClient()` (service role key, admin ops only)

All API routes call `supabase.auth.getUser()` at the top — never trust client-provided user IDs.

### Demo mode (`src/lib/demo.ts`)

When `NEXT_PUBLIC_SUPABASE_URL` contains `'your-project'` (or is empty), the app runs in demo mode — no Supabase required.

- `isSupabaseConfigured()` — checked at the top of every API route
- Login sets an `httpOnly` cookie `myshift_demo` with `{ pseudo, role, target_lph }`
- `getDemoProfile()` reads that cookie and returns a mock `Profile`
- All API routes return mock/empty data
- `src/proxy.ts` reads the cookie for auth redirect instead of Supabase session

### Adding a new API route

All routes follow the same pattern: demo guard → get user → validate → query with RLS.

```ts
import { isSupabaseConfigured } from '@/lib/demo'

if (!isSupabaseConfigured()) return NextResponse.json(/* mock data */)

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=       # Public, safe in browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Public, safe in browser
SUPABASE_SERVICE_ROLE_KEY=      # Server-only — never expose to client
```

## Database

Schema: `supabase/schema.sql`. Run once in Supabase SQL editor.

Tables: `profiles`, `pause_schedules`, `work_sessions`, `missions`, `mission_supports`, `pauses`, `production_snapshots`.

One session per user per day (`unique(user_id, date)` on `work_sessions`). Sessions are upserted via `/api/sessions` POST with `onConflict: 'user_id,date'`.

The trigger `on_auth_user_created` auto-creates a `profiles` row on Supabase user creation, pulling `pseudo` from `raw_user_meta_data` and `role` from `raw_app_meta_data`.

### Schema additions (run manually in Supabase SQL editor if not in schema.sql)

```sql
-- Notes sur les missions
alter table public.missions add column if not exists notes text;

-- Lignes restantes sur la commande (régule) — ne modifie pas la mission
alter table public.production_snapshots add column if not exists remaining_command_lines integer;
```

## Critical rules (never break these)

- **Missions are immutable once created.** `total_pad_lines` is set at creation and never modified. All post-creation adjustments go through the snapshot's `remaining_command_lines` field.
- **`today()` uses local date components** (not `toISOString()` which is UTC — causes wrong date after midnight in France).
- **`fakeEmail()` must strip accents** before building the email — Supabase rejects non-ASCII in the local part.
