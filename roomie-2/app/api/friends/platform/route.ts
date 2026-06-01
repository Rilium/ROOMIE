import { listUsers } from '@/lib/neon-db'
import { requireAuth, storageGuard } from '@/lib/api-helpers'

export async function GET(req: Request) {
  const guard = storageGuard()
  if (guard) return guard

  const auth = await requireAuth(req)
  if (auth instanceof Response) return auth
  const { user } = auth
  const q = new URL(req.url).searchParams.get('q')?.trim().toLowerCase() || ''
  if (q.length < 2) return Response.json({ friends: [] })

  const allUsers = await listUsers()
  const friends = allUsers
    .filter(u => u.id !== user.id && u.role !== 'admin' && !u.suspended)
    .filter(u => {
      const username = String(u.username || '').toLowerCase()
      const name = String(u.name || '').toLowerCase()
      return username.includes(q) || name.includes(q)
    })
    .slice(0, 8)
    .map(u => ({
      id: u.id,
      username: u.username,
      name: u.name || u.username,
      initials: String(u.name || u.username || 'U')
        .split(/\s+/)
        .slice(0, 2)
        .map((part: string) => part[0] || '')
        .join('')
        .toUpperCase(),
      meta: '@' + (u.username || 'utente'),
    }))

  return Response.json({ friends })
}
