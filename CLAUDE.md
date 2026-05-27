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

Next.js 16 App Router + Supabase + Zustand. Mobile-first dark UI for warehouse use (gros boutons, thème noir).

### Route groups

- `src/app/(auth)/` — public (login, setup)
- `src/app/(app)/` — protected user pages with bottom nav
- `src/app/admin/` — admin-only (server-side role check in layout)
- `src/app/api/` — API routes (all protected via `supabase.auth.getUser()`)
- `src/proxy.ts` — Next.js 16 proxy (renamed from middleware). Handles auth redirect + admin guard.

### Auth model

No email. Supabase Auth with fake email `{pseudo}@myshift.internal` + password (minimum 4 chars, not restricted to digits).

- Role stored in `auth.users.app_metadata.role` (NOT in profiles table) — this avoids infinite RLS recursion when checking profiles.
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
| **Réel** | sum of mission durations only |

The three LPH metrics require at least one `production_snapshot`. Before the first injection, they return `null` and the UI shows "En attente".

**Mission projection** (`projectedEndTime`, `projectedRemainingLines`) is independent of snapshots — it's always computed when a mission is active:
- `pace = theoreticalLph ?? targetLph` (falls back to target objective if no snapshot yet)
- `remaining = max(0, activeMission.total_pad_lines − pace × elapsedMissionHours)`
- `projectedEndTime = now + remaining / pace`

This gives the literal clock time when the current mission will finish. Displayed in the "Fin mission" stat card and the active mission vignette. Updates every second via `store.tick()`.

`calcStats()` is a pure function. Also returns `cushionLph` (how much you can slow down vs target) and `diffLinesTotal` (line advance/lag vs target pace).

### Key domain terms

- **Lignes pad** ≠ **Lignes finales**: pad lines = what the mission form shows; final lines = cumulative count given by saying "production" to the pad device. Only final lines count for productivity.
- **Production snapshot**: when the user says "production" to the pad and gets a cumulative total. The user enters this number manually. It's the anchor for all productivity calculations.
- **Support types**: `role` (vertical multi-shelf, up to 3 per mission, better productivity) vs `palette` (single client, up to 2 per mission).
- **Pause décomptée** (`is_system_deducted: true`): subtracted by the Magellan system from pad time. Only the 16h00 pause (21min) is system-deducted. The 14h00 and 18h00 pauses are not — they drag down the pad metric but not the theoretical.

### Supabase clients

- `src/lib/supabase/client.ts` — browser client (Client Components)
- `src/lib/supabase/server.ts` — exports `createClient()` (anon key, for Server Components/Routes) and `createServiceClient()` (service role key, admin ops only)

All API routes call `supabase.auth.getUser()` at the top — never trust client-provided user IDs.

### Demo mode (`src/lib/demo.ts`)

When `NEXT_PUBLIC_SUPABASE_URL` contains `'your-project'` (or is empty), the app runs in demo mode — no Supabase required.

- `isSupabaseConfigured()` — checked at the top of every API route
- Login sets an `httpOnly` cookie `myshift_demo` with `{ pseudo, role, target_lph }`
- `getDemoProfile()` reads that cookie and returns a mock `Profile`
- All API routes return mock/empty data (empty arrays for lists, fake objects for creates/updates)
- `src/proxy.ts` reads the cookie for auth redirect instead of Supabase session

### Adding a new API route

All routes follow the same pattern: demo guard → get user → validate → query with RLS. The RLS policies on every table enforce `user_id = auth.uid()`, so even if the API omits a filter, data is isolated.

```ts
import { isSupabaseConfigured } from '@/lib/demo'

// Demo guard first
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
