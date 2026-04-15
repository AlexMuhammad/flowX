import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import TopNav from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'FlowX — Intent-driven liquidity on X Layer',
  description:
    'Describe what you want in plain English. Three AI solvers compete, the winner runs on X Layer mainnet.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <Providers>
          <TopNav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
