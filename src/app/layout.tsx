import type { Metadata, Viewport } from 'next';
import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { auth } from '@/lib/auth/auth';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'CivicChain — From Civic Complaints to Verifiable Accountability',
    template: '%s | CivicChain',
  },
  description: 'An AI-powered civic accountability platform that transforms civic complaints into measurable commitments with AI verification, deadline tracking, and transparent accountability.',
  keywords: ['civic', 'accountability', 'government', 'complaints', 'AI', 'verification', 'transparency', 'smart city'],
  authors: [{ name: 'CivicChain Team' }],
  creator: 'CivicChain',
  publisher: 'CivicChain',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://civicchain.io',
    title: 'CivicChain — From Civic Complaints to Verifiable Accountability',
    description: 'An AI-powered civic accountability platform that transforms civic complaints into measurable commitments.',
    siteName: 'CivicChain',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CivicChain — Civic Accountability Infrastructure',
    description: 'Transform civic complaints into trackable, verifiable commitments.',
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-dark-bg text-neutral-900 dark:text-neutral-100">
        <SessionProvider session={session?.user ? { user: { id: session.user.id, role: session.user.role } } : null}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}