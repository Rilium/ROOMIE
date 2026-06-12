# ROOMIE Production Env

Questi valori NON vanno committati con segreti reali. Vanno impostati in Vercel Project Settings -> Environment Variables.

Variabili Clerk obbligatorie in produzione:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

Redirect da configurare in Clerk:

```text
https://roomie.rilio.it/sso-callback
https://roomie.rilio.it/sign-in
https://roomie.rilio.it/sign-up
```

Prima di deployare:

```bash
npm run env:check:prod
```

Il build Vercel Production esegue anche un guard automatico: se queste variabili mancano o sono placeholder, il deploy viene fermato invece di pubblicare un auth rotto.
