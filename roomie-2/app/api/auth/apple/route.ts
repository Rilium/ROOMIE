import { redirectWithAuthError } from '@/lib/api-helpers'

export function GET(req: Request) {
  return redirectWithAuthError(req, 'APPLE_NOT_CONFIGURED')
}
