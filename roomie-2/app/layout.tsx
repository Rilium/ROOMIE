import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { ClerkProvider } from '@clerk/nextjs'

export const viewport: Viewport = {
  themeColor: '#0D0D0D',
}

export const metadata: Metadata = {
  title: 'ROOMIE Torino | Room privata a ore in Via Terni',
  description: 'ROOMIE è la tua room privata a Torino: prenoti a ore, entri con chip o codice e hai spazio, console, streaming e vibe per la tua serata.',
  robots: 'index,follow,max-image-preview:large',
  applicationName: 'ROOMIE',
  appleWebApp: { title: 'ROOMIE' },
  metadataBase: new URL('https://roomie.rilio.it'),
  alternates: { canonical: '/' },
  openGraph: {
    locale: 'it_IT',
    type: 'website',
    siteName: 'ROOMIE',
    title: 'ROOMIE Torino | La tua room privata a ore',
    description: 'Prenoti la room, entri con chip o codice, hai uno spazio privato a Torino per gaming, film, partite e serate con amici.',
    url: 'https://roomie.rilio.it/',
    images: [{
      url: 'https://roomie.rilio.it/assets/seo/roomie-og.jpg',
      secureUrl: 'https://roomie.rilio.it/assets/seo/roomie-og.jpg',
      type: 'image/jpeg',
      width: 1200,
      height: 630,
      alt: 'ROOMIE, room privata a ore in Via Terni a Torino',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ROOMIE Torino | La tua room privata a ore',
    description: 'Gaming, film, partite e serate: prenoti a ore ed entri con chip o codice.',
    images: {
      url: 'https://roomie.rilio.it/assets/seo/roomie-og.jpg',
      alt: 'ROOMIE, room privata a ore in Via Terni a Torino',
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
    <html lang="it">
      <head>
        {/* Structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: 'ROOMIE',
              url: 'https://roomie.rilio.it/',
              image: 'https://roomie.rilio.it/assets/seo/roomie-og.jpg',
              description: 'Room privata prenotabile a ore a Torino, con accesso digitale, console, streaming e spazio per serate con amici.',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Via Terni',
                addressLocality: 'Torino',
                addressRegion: 'Piemonte',
                addressCountry: 'IT',
              },
              priceRange: 'Da 12 chips/ora',
              areaServed: 'Torino',
            }),
          }}
        />

        {/* Animated favicon placeholder — set by roomie.js initAnimatedFavicon() */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <link id="roomie-favicon" rel="icon" type="image/svg+xml" href="/favicon.svg" />

        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;0,900;1,400&family=Barlow+Condensed:wght@400;600;700;900&family=JetBrains+Mono:wght@700;800&display=swap"
          rel="stylesheet"
        />

        {/* FontAwesome Pro 5 */}
        <link
          rel="stylesheet"
          href="https://pro.fontawesome.com/releases/v5.15.3/css/all.css"
          integrity="sha384-iKbFRxucmOHIcpWdX9NTZ5WETOPm0Goy0WmfyNcl52qSYtc2Buk0NCe6jU1sWWNB"
          crossOrigin="anonymous"
        />

        {/* ROOMIE custom CSS */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/assets/css/roomie.css?v=prod-20260607-profile-css" />

        {/* GSAP — must load before roomie.js */}
        <Script
          src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="auth-logged-out app-booting" suppressHydrationWarning>
        {/* Bagliori neon ambientali di sfondo */}
        <div className="neon-ambient" aria-hidden="true">
          <span className="glow glow-1"></span>
          <span className="glow glow-2"></span>
          <span className="glow glow-3"></span>
        </div>
        {children}

        {/* ROOMIE app logic — must run after DOM */}
        <Script src="/assets/js/roomie.js?v=prod-20260604-auth-fix3" strategy="afterInteractive" />
      </body>
    </html>
    </ClerkProvider>
  )
}
