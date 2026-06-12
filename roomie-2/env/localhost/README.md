# ROOMIE Localhost Env

Questa cartella e' per configurazione locale. Tutto e' ignorato da git tranne README e template.

Uso consigliato:

```bash
cp env/localhost/.env.local.example .env.local
npm run dev
```

Clerk locale:

- lascia `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` vuote per usare Clerk keyless/dev mode;
- usa chiavi reali `pk_test_...` e `sk_test_...` se devi testare login utenti reali e Google OAuth;
- non usare placeholder come `pk_test_YOUR_KEY`: rompono il loader Clerk.

Google OAuth con utenti reali funziona solo se l'istanza Clerk usata ha Google configurato e accetta i redirect localhost.
