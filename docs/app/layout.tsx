import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { appDescription, appName, docsSiteUrl } from '@/lib/shared';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(docsSiteUrl),
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: appDescription,
  keywords: [
    'SVG',
    'diagrams',
    'hand-drawn',
    'React',
    'ScribbleSVG',
    'diagram editor',
  ],
  authors: [{ name: 'Ashutosh Bind' }],
  creator: 'Ashutosh Bind',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: docsSiteUrl,
    siteName: appName,
    title: appName,
    description: appDescription,
    images: [
      {
        url: '/brand/icon.png',
        width: 512,
        height: 512,
        alt: appName,
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: appName,
    description: appDescription,
    images: ['/brand/icon.png'],
  },
  appleWebApp: {
    title: appName,
    capable: true,
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0c0c' },
  ],
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
