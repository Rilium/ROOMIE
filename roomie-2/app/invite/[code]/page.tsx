import Link from 'next/link'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const safeCode = encodeURIComponent(code || '')

  return (
    <main className="invite-page">
      <section className="invite-shell">
        <div className="invite-media" aria-hidden="true">
          <div className="invite-live-chip">
            <span></span>
            INVITO ROOMIE
          </div>
        </div>
        <div className="invite-copy">
          <div className="invite-kicker">Clubhouse privata · Torino</div>
          <h1>Ti hanno invitato in Roomie.</h1>
          <p>
            Crea il profilo, accetta Termini e Privacy, poi l&apos;host potrà aggiungerti al gruppo della sessione.
          </p>
          <div className="invite-code">Codice invito · {code}</div>
          <div className="invite-actions">
            <Link className="btn-neon" href={`/sign-up?invite=${safeCode}`}>
              ISCRIVITI
            </Link>
            <Link className="btn-outline-neon" href={`/sign-in?invite=${safeCode}`}>
              HO GIA&apos; UN ACCOUNT
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
