import { acceptUserLegal, mockVerifyUserDocument, publicUser, revokeUserLegal } from '@/lib/repositories/users'
import { csrfGuard, requireAuth, storageGuard } from '@/lib/api-helpers'

function cleanLast4(value: unknown): string {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase()
}

export async function POST(req: Request) {
  const guard = storageGuard()
  if (guard) return guard
  const csrf = csrfGuard(req)
  if (csrf) return csrf

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth

  const body = await req.json().catch(() => ({})) as {
    action?: string
    documentType?: 'id_card' | 'driver_license'
    documentLast4?: string
    documentName?: string
  }

  if (body.action === 'accept_legal') {
    const user = await acceptUserLegal(auth.user.id)
    return Response.json({ user: user ? publicUser(user) : publicUser(auth.user) })
  }

  if (body.action === 'revoke_legal') {
    const user = await revokeUserLegal(auth.user.id)
    return Response.json({ user: user ? publicUser(user) : publicUser(auth.user) })
  }

  if (body.action === 'mock_verify_document') {
    const documentType = body.documentType === 'driver_license' ? 'driver_license' : 'id_card'
    const documentLast4 = cleanLast4(body.documentLast4)
    const documentName = String(body.documentName || auth.user.name || auth.user.email || 'Documento Roomie')
      .trim()
      .slice(0, 80)

    if (documentLast4.length < 2) {
      return Response.json({ error: 'DOCUMENT_LAST4_REQUIRED' }, { status: 400 })
    }

    const user = await mockVerifyUserDocument(auth.user.id, {
      documentType,
      documentLast4,
      documentName,
    })
    return Response.json({ user: user ? publicUser(user) : publicUser(auth.user) })
  }

  return Response.json({ error: 'UNKNOWN_ONBOARDING_ACTION' }, { status: 400 })
}
