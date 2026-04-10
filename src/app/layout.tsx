import type { Metadata } from "next";
import { Space_Grotesk, Bebas_Neue } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import CS2Background from '@/components/ui/cs2-background';
import Footer from '@/components/ui/footer';
import { Toaster } from 'sonner';
import { getPublicStats } from '@/server/raffle-actions';

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://romanovdasrifas.vercel.app'),
  title: {
    default: 'Romanov Rifas | Skins de CS2',
    template: '%s | Romanov Rifas',
  },
  description: 'Concorra a skins raras de CS2 com rifas a partir de R$0,50. Sorteio transparente pela Loteria Federal, pagamento via PIX e entrega imediata da skin.',
  keywords: ['rifa cs2', 'skin cs2', 'rifa skins', 'rifas online', 'rifa pix', 'cs2 raffle', 'romanov rifas'],
  authors: [{ name: 'Romanov Rifas' }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  openGraph: {
    title: 'Romanov Rifas | Skins de CS2',
    description: 'Concorra a skins raras de CS2. Rifas com pagamento via PIX, sorteio transparente pela Loteria Federal e entrega imediata.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Romanov Rifas',
    images: [{
      url: '/logo-icon.png',
      width: 400,
      height: 400,
      alt: 'Romanov Rifas',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Romanov Rifas | Skins de CS2',
    description: 'Concorra a skins raras de CS2 com rifas a partir de R$0,50.',
    images: ['/logo-icon.png'],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const stats = await getPublicStats();

  return (
    <html lang="pt-BR">
      <body className={`${spaceGrotesk.variable} ${bebasNeue.variable} antialiased`}>
        <CS2Background />
        <Header />
        <main>{children}</main>
        <Footer stats={stats} />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#111114',
              border: '1px solid #2A2A32',
              color: '#F0EAD6',
            },
          }}
        />
      </body>
    </html>
  );
}
