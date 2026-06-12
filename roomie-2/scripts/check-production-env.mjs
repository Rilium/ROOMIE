import { existsSync, readFileSync } from 'node:fs'

const envFile = process.argv[2]

function parseEnvFile(path) {
  if (!path || !existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const idx = trimmed.indexOf('=')
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    value = value.replace(/^['"]|['"]$/g, '')
    env[key] = value
  }
  return env
}

const fileEnv = parseEnvFile(envFile)
const read = key => process.env[key] ?? fileEnv[key] ?? ''
const unusable = value => !value || /YOUR_KEY|placeholder|change-me|\.\.\./i.test(value)

const required = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
]

const missing = required.filter(key => unusable(read(key)))

if (missing.length) {
  console.error('Missing/invalid production env:')
  for (const key of missing) console.error(`- ${key}`)
  console.error('\nSet these in Vercel Production before deploying ROOMIE.')
  process.exit(1)
}

console.log('Production env check passed.')
