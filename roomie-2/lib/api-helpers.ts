// ── API HELPERS ───────────────────────────────────────────────────────────────
// Helpers per Next.js App Router — usa neon-db.ts (Postgres relazionale).

import { getSessionFromRequest } from './session'
import { getUserById } from './neon-db'
import type { DbUser } from './types'

export const IS_PRODUCTION_RUNTIME =
  Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production'
export const STORAGE_OK = Boolean(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL,
)

/** 503 se DATABASE_URL non è configurato. */
export function storageGuard(): Response | null {
  if (!STORAGE_OK) {
    return Response.json(
      { error: 'STORAGE_NOT_CONFIGURED', message: 'Configura DATABASE_URL prima di usare dati reali.' },
      { status: 503 },
    )
  }
  return null
}

export function getSession(req: Request) {
  return getSessionFromRequest(req)
}

export function getAuthUserId(req: Request): string | null {
  return getSessionFromRequest(req).userId ?? null
}

/** Legge utente autenticato dal DB oppure restituisce Response 401. */
export async function requireAuth(req: Request): Promise<{ user: DbUser } | Response> {
  const userId = getAuthUserId(req)
  if (!userId) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  const user = await getUserById(userId)
  if (!user) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 })
  if (user.suspended) return Response.json({ error: 'ACCOUNT_SUSPENDED' }, { status: 403 })
  return { user }
}

/** Come requireAuth ma verifica anche role=admin. */
export async function requireAdmin(req: Request): Promise<{ user: DbUser } | Response> {
  const result = await requireAuth(req)
  if (result instanceof Response) return result
  if (result.user.role !== 'admin') return Response.json({ error: 'ADMIN_REQUIRED' }, { status: 403 })
  return result
}

/** Estrae base URL dalla request. */
export function appBaseUrl(req: Request): string {
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host
  return (process.env.APP_URL || `${proto}://${host}`).replace(/\/$/, '')
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = String(token || '').split('.')[1]
    if (!payload) return {}
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function googleTokenErrorCode(token: Record<string, unknown> = {}): string {
  const error = String(token.error || '')
  const description = String(token.error_description || '').toLowerCase()
  if (error === 'invalid_client' || description.includes('client secret')) return 'GOOGLE_SECRET_INVALID'
  if (error === 'invalid_grant' || description.includes('bad request')) return 'GOOGLE_CODE_EXPIRED'
  if (description.includes('redirect_uri')) return 'GOOGLE_REDIRECT_MISMATCH'
  return 'GOOGLE_TOKEN_ERROR'
}

export function redirectWithAuthError(req: Request, code = 'SOCIAL_NOT_CONFIGURED'): Response {
  const base = appBaseUrl(req)
  return Response.redirect(`${base}/?auth_error=${encodeURIComponent(code)}`, 302)
}

export function googleCallbackBridgeHtml(): string {
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ROOMIE Google Login</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#050505;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh;overflow:hidden}
    body:before{content:'';position:fixed;inset:0;background:radial-gradient(circle at 50% 42%,rgba(200,255,0,.18),transparent 34%),linear-gradient(180deg,rgba(0,0,0,.96),rgba(6,8,3,.98))}
    .wrap{position:relative;text-align:center;padding:28px;display:flex;flex-direction:column;align-items:center;gap:18px}
    .brand{font-family:Impact,Arial Black,sans-serif;font-size:clamp(54px,14vw,104px);line-height:.82;letter-spacing:.08em;color:#c8ff00;text-shadow:0 0 22px rgba(200,255,0,.72),0 0 70px rgba(200,255,0,.32)}
    .chip{width:132px;height:132px;border-radius:50%;position:relative;background:radial-gradient(circle at 34% 28%,#fff 0 7%,transparent 8%),radial-gradient(circle at 50% 50%,#151515 0 33%,#c8ff00 34% 44%,#111 45% 58%,#c8ff00 59% 72%,#050505 73% 100%);border:1px solid rgba(255,255,255,.24);box-shadow:inset 0 1px 3px rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.75),0 0 44px rgba(200,255,0,.56);animation:spin .72s cubic-bezier(.22,1,.36,1) infinite}
    .chip:before{content:'R';position:absolute;inset:24%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,#f7ffd6,#a6d800);color:#111;font-size:44px;font-weight:900}
    .copy{font-size:18px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.sub{max-width:310px;color:rgba(255,255,255,.58);line-height:1.45;font-size:14px;font-weight:700}
    @keyframes spin{from{transform:rotateY(0deg) rotateZ(0deg)}to{transform:rotateY(360deg) rotateZ(12deg)}}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">ROOMIE</div>
    <div class="chip" aria-hidden="true"></div>
    <div class="copy">ACCESSO GOOGLE</div>
    <div class="sub">Confermiamo il profilo e prepariamo saldo chips, dashboard e prossima sessione.</div>
  </div>
  <script>
  (async function(){
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const body = { id_token: hash.get('id_token'), state: hash.get('state') };
    try {
      const res = await fetch('/api/auth/google/token', {
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok || !data.redirect) throw new Error(data.error || 'SOCIAL_LOGIN_ERROR');
      location.replace(data.redirect);
    } catch (err) {
      location.replace('/?auth_error=' + encodeURIComponent(err.message || 'SOCIAL_LOGIN_ERROR'));
    }
  })();
  </script>
</body>
</html>`
}
