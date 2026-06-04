function hasUsableClerkKey(value: string | undefined, prefix: string): boolean {
  const key = value?.trim() ?? ''
  return key.startsWith(prefix) && key.length >= 30 && !/YOUR_KEY|placeholder|change-me/i.test(key)
}

export function hasUsableClerkPublishableKey(): boolean {
  return hasUsableClerkKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, 'pk_')
}

export function hasUsableClerkSecretKey(): boolean {
  return hasUsableClerkKey(process.env.CLERK_SECRET_KEY, 'sk_')
}

export function hasUsableClerkConfig(): boolean {
  return hasUsableClerkPublishableKey() && hasUsableClerkSecretKey()
}
