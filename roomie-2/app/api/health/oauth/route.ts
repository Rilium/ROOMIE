export function GET() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID || ''
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  return Response.json({
    google: {
      clientIdPresent: Boolean(googleClientId),
      clientIdLooksValid: /\.apps\.googleusercontent\.com$/.test(googleClientId),
      clientIdLength: googleClientId.length,
      clientSecretPresent: Boolean(googleClientSecret),
      clientSecretLooksValid: /^GOCSPX-/.test(googleClientSecret),
      clientSecretLength: googleClientSecret.length,
      flow: 'id_token',
      secretRequired: false,
      redirectUri: `${process.env.APP_URL || 'https://roomie.rilio.it'}/api/auth/google/callback`,
    },
  })
}
