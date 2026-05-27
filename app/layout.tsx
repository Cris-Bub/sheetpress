import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegister } from '@/components/app/service-worker-register';
import { ThemeProvider } from '@/components/app/theme-provider';
import { QueryProvider } from '@/components/app/query-provider';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const serif = Fraunces({
  variable: '--font-serif',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['SOFT', 'opsz'],
});

export const metadata: Metadata = {
  title: 'sheetPress — invoicing for freelancers',
  description: 'Make an invoice. Get a PDF. Track who paid. That’s it.',
  appleWebApp: {
    capable: true,
    title: 'sheetPress',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf9f4' },
    { media: '(prefers-color-scheme: dark)', color: '#252525' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster position="bottom-right" />
            <ServiceWorkerRegister />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
