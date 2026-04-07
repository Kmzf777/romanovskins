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
  title: "Romanov Rifas | Skins de CS2",
  description: "Concorra a skins raras de CS2. Rifas com pagamento via PIX, sorteio transparente pela Loteria Federal e entrega imediata.",
  openGraph: {
    title: "Romanov Rifas | Skins de CS2",
    description: "Concorra a skins raras de CS2. Rifas com pagamento via PIX e sorteio transparente.",
    type: "website",
    images: ["/logo-icon.png"],
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
