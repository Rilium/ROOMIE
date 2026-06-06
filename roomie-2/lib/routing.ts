export type RoomiePage = 'home' | 'room' | 'token' | 'confirm' | 'session' | 'shop' | 'dashboard' | 'admin'

export const PAGE_TO_PATH: Record<string, string> = {
  home: '/',
  room: '/room',
  token: '/token',
  confirm: '/confirm',
  session: '/session',
  shop: '/shop',
  dashboard: '/dashboard',
  admin: '/admin',
}

export const PATH_TO_PAGE: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_TO_PATH).map(([page, path]) => [path, page])
)

export const PROTECTED_PAGES: readonly string[] = [
  'checkout',
  'confirm',
  'session',
  'dashboard',
  'token',
  'shop',
  'admin',
]
