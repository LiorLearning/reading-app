import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

export const metadata: Metadata = {
  title: 'Readkraft: Fall in love with ELA',
  description: 'Learn to spell with your favorite pet while you create',
  authors: [{ name: 'Lior' }],
  icons: {
    icon: '/avatars/favicon.png',
    shortcut: '/avatars/favicon.png',
    apple: '/avatars/favicon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Readkraft: Fall in love with ELA',
    description: 'Learn to spell with your favorite pet while you create',
    type: 'website',
    url: 'https://readkraft.com/',
    images: [
      {
        url: 'https://readkraft.com/preview.jpeg',
        width: 1200,
        height: 630,
        alt: 'Readkraft: Fall in love with ELA',
      },
    ],
    siteName: 'Readkraft',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Readkraft: Fall in love with ELA',
    description: 'Learn to spell with your favorite pet while you create',
    images: ['https://readkraft.com/preview.jpeg'],
    creator: '@readkraft',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap" rel="stylesheet" />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init Ce js Ls Te Fs Ds capture Ye calculateEventProperties Us register register_once register_for_session unregister unregister_for_session Ws getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Bs zs createPersonProfile Hs Ms Gs opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Ns debug L qs getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
              posthog.init('phc_aJ82NfLQeMzHOi7QiipHxz1kmr1JnlxBgU6RihYT13Q', {
                api_host: 'https://us.i.posthog.com',
                person_profiles: 'identified_only'
              });
              try { posthog.startSessionRecording(); } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
