import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { DevHelper } from '@/components/app/dev-helper';
import { ThemeProvider } from '@/components/app/theme-provider';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

// Fraunces — warm variable serif with optical sizing. Less clinical than Instrument Serif,
// more readable than DM Serif. Personality without being precious.
const serif = Fraunces({
  variable: '--font-serif',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['SOFT', 'opsz'],
});

export const metadata: Metadata = {
  title: 'sheetPress — invoicing for freelancers',
  description: 'Make an invoice. Get a PDF. Track who paid. That’s it.',
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
          {children}
          <Toaster position="bottom-right" />
          {process.env.NODE_ENV === 'development' ? <DevHelper /> : null}
        </ThemeProvider>
      </body>
    </html>
  );
}
