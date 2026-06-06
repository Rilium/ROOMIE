import { getOrCreateRoomieUserFromClerk, getUserByClerkId } from '@/lib/neon-db'
import { STORAGE_OK } from '@/lib/api-helpers'
import { hasUsableClerkConfig } from '@/lib/clerk-config'

export const runtime = 'nodejs'

function cleanError(err: unknown) {
  if (!err || typeof err !== 'object') return String(err)
  const error = err as {
    name?: unknown
    code?: unknown
    status?: unknown
    message?: unknown
    errors?: Array<{ code?: unknown; message?: unknown }>
  }
  return {
    name: typeof error.name === 'string' ? error.name : undefined,
    code: typeof error.code === 'string' ? error.code : undefined,
    status: typeof error.status === 'number' ? error.status : undefined,
    message: typeof error.message === 'string' ? error.message : undefined,
    errors: Array.isArray(error.errors)
      ? error.errors.map(item => ({
          code: typeof item.code === 'string' ? item.code : undefined,
          message: typeof item.message === 'string' ? item.message : undefined,
        }))
      : undefined,
  }
}

function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split('.')
    if (!payload) return { ok: false, error: 'MISSING_PAYLOAD' }
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      azp?: unknown
      exp?: unknown
      iat?: unknown
      iss?: unknown
      nbf?: unknown
      sid?: unknown
      sts?: unknown
      sub?: unknown
      v?: unknown
    }
    return {
      ok: true,
      claims: {
        azp: claims.azp,
        exp: claims.exp,
        iat: claims.iat,
        iss: claims.iss,
        nbf: claims.nbf,
        sid: claims.sid,
        sts: claims.sts,
        sub: claims.sub,
        v: claims.v,
      },
    }
  } catch (err) {
    return { ok: false, error: cleanError(err) }
  }
}

export async function GET(req: Request) {
  const authorization = req.headers.get('authorization') || ''
  const bearer = authorization.replace(/^Bearer\s+/i, '').trim()
  const cookieNames = (req.headers.get('cookie') || '')
    .split(';')
    .map(cookie => cookie.trim().split('=')[0])
    .filter(Boolean)

  const out: Record<string, unknown> = {
    ok: true,
    url: req.url,
    env: {
      storageOk: STORAGE_OK,
      clerkConfigOk: hasUsableClerkConfig(),
      hasClerkSecret: Boolean(process.env.CLERK_SECRET_KEY),
      hasPublishable: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
      appUrl: process.env.APP_URL || null,
      nodeEnv: process.env.NODE_ENV,
      vercel: Boolean(process.env.VERCEL),
    },
    request: {
      hasAuthorization: Boolean(authorization),
      bearerLength: bearer.length,
      cookieNames,
      host: req.headers.get('host'),
      forwardedHost: req.headers.get('x-forwarded-host'),
      forwardedProto: req.headers.get('x-forwarded-proto'),
    },
    token: bearer ? decodeJwtPayload(bearer) : null,
  }

  try {
    const { auth, clerkClient, currentUser, verifyToken } = await import('@clerk/nextjs/server')

    try {
      const authResult = await auth()
      out.auth = {
        ok: true,
        userId: authResult.userId,
        sessionId: authResult.sessionId,
      }
    } catch (err) {
      out.auth = { ok: false, error: cleanError(err) }
    }

    try {
      const user = await currentUser()
      out.currentUser = {
        ok: true,
        id: user?.id || null,
        email: user?.primaryEmailAddress?.emailAddress || null,
      }
    } catch (err) {
      out.currentUser = { ok: false, error: cleanError(err) }
    }

    let verifiedSub: string | null = null
    if (bearer) {
      try {
        const claims = await verifyToken(bearer, {
          secretKey: process.env.CLERK_SECRET_KEY,
        }) as { sub?: string; sid?: string; iss?: string; azp?: string }
        verifiedSub = claims.sub || null
        out.verifyToken = {
          ok: true,
          sub: claims.sub || null,
          sid: claims.sid || null,
          iss: claims.iss || null,
          azp: claims.azp || null,
        }
      } catch (err) {
        out.verifyToken = { ok: false, error: cleanError(err) }
      }
    }

    if (verifiedSub && STORAGE_OK) {
      try {
        const linked = await getUserByClerkId(verifiedSub)
        out.dbLinkedUser = linked
          ? { ok: true, found: true, id: linked.id, email: linked.email, role: linked.role, suspended: linked.suspended }
          : { ok: true, found: false }
      } catch (err) {
        out.dbLinkedUser = { ok: false, error: cleanError(err) }
      }

      try {
        const client = await clerkClient()
        const clerkUser = await client.users.getUser(verifiedSub)
        out.clerkApiUser = {
          ok: true,
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || null,
          emailCount: clerkUser.emailAddresses.length,
        }

        try {
          const roomieUser = await getOrCreateRoomieUserFromClerk(clerkUser)
          out.getOrCreateRoomieUser = roomieUser
            ? { ok: true, id: roomieUser.id, email: roomieUser.email, role: roomieUser.role, suspended: roomieUser.suspended }
            : { ok: true, user: null }
        } catch (err) {
          out.getOrCreateRoomieUser = { ok: false, error: cleanError(err) }
        }
      } catch (err) {
        out.clerkApiUser = { ok: false, error: cleanError(err) }
      }
    }
  } catch (err) {
    out.importClerkServer = { ok: false, error: cleanError(err) }
  }

  return Response.json(out, {
    headers: {
      'cache-control': 'no-store',
    },
  })
}
