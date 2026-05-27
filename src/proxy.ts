import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEMO_COOKIE = 'myshift_demo'

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return !!url && !url.includes('your-project')
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Routes publiques
  const publicPaths = ['/login', '/setup', '/api/auth/login', '/api/auth/logout', '/api/setup']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next({ request })
  }

  // ── Mode démo (Supabase non configuré) ──────────────────
  if (!isSupabaseConfigured()) {
    const demoCookie = request.cookies.get(DEMO_COOKIE)
    if (!demoCookie) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next({ request })
  }

  // ── Mode normal (Supabase configuré) ────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)',
  ],
}
