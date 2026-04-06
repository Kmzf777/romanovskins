import type { Metadata } from "next";
import { Space_Grotesk, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import HeroAscii from '@/components/ui/hero-ascii';
import { Toaster } from 'sonner';

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Romanov Rifas | Skins de CS2",
  description: "Concorra a skins raras de CS2. Rifas com pagamento via PIX, sorteio transparente pela Loteria Federal e entrega imediata.",
  openGraph: {
    title: "Romanov Rifas | Skins de CS2",
    description: "Concorra a skins raras de CS2. Rifas com pagamento via PIX e sorteio transparente.",
    type: "website",
    images: ["/logo-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${spaceGrotesk.variable} ${sourceSans.variable} antialiased`}>
        <HeroAscii />
        <Header />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A1D',
              border: '1px solid #3A3A3F',
              color: '#FFFFFF',
            },
          }}
        />
      </body>
    </html>
  );
}
