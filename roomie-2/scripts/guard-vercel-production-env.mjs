const isVercelProduction = process.env.VERCEL_ENV === 'production'

if (!isVercelProduction) {
  console.log('Skipping production env guard outside Vercel Production.')
  process.exit(0)
}

const read = key => process.env[key] ?? ''
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
  console.error('Vercel Production env is missing required Clerk variables:')
  for (const key of missing) console.error(`- ${key}`)
  console.error('\nSet real Clerk Production keys in Vercel before deploying ROOMIE.')
  process.exit(1)
}

console.log('Vercel Production env guard passed.')
