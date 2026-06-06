function hasUsableClerkKey(value: string | undefined): boolean {
  const key = value?.trim() ?? ''
  return key.length > 0 && key !== '""' && !/YOUR_KEY|placeholder|change-me/i.test(key)
}

export function hasUsableClerkPublishableKey(): boolean {
  return hasUsableClerkKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
}

export function hasUsableClerkSecretKey(): boolean {
  return hasUsableClerkKey(process.env.CLERK_SECRET_KEY)
}

export function hasUsableClerkConfig(): boolean {
  return hasUsableClerkPublishableKey() && hasUsableClerkSecretKey()
}
