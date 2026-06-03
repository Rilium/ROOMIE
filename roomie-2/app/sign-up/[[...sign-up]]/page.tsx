import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D0D0D',
        fontFamily: "'Barlow Condensed', sans-serif",
        padding: '2rem 1rem',
      }}
    >
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '2.5rem',
            color: '#C8FF00',
            letterSpacing: '0.15em',
          }}
        >
          ROOMIE
        </span>
      </div>
      <SignUp
        appearance={{
          variables: {
            colorBackground: '#141414',
            colorInputBackground: '#1a1a1a',
            colorInputText: '#f0f0f0',
            colorText: '#f0f0f0',
            colorTextSecondary: '#999',
            colorPrimary: '#C8FF00',
            colorDanger: '#ff4444',
            borderRadius: '8px',
            fontFamily: "'Barlow Condensed', sans-serif",
          },
          elements: {
            rootBox: { width: '100%', maxWidth: '420px' },
            card: {
              background: '#141414',
              border: '1px solid #222',
              boxShadow: '0 0 40px rgba(200,255,0,0.06)',
            },
            headerTitle: {
              color: '#C8FF00',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '1.8rem',
              letterSpacing: '0.1em',
            },
            headerSubtitle: { color: '#999' },
            formButtonPrimary: {
              background: '#C8FF00',
              color: '#0D0D0D',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            },
            footerActionLink: { color: '#C8FF00' },
            formFieldLabel: { color: '#ccc' },
            dividerLine: { background: '#333' },
            dividerText: { color: '#666' },
            socialButtonsBlockButton: {
              border: '1px solid #333',
              color: '#f0f0f0',
              background: '#1a1a1a',
            },
            socialButtonsBlockButtonText: { color: '#f0f0f0' },
          },
        }}
      />
    </main>
  )
}
