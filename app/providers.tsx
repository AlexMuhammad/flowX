'use client';

import { useState, type ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { xLayer } from 'viem/chains';
import {
  RainbowKitProvider,
  getDefaultConfig,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { X402PaymentProvider } from '@/components/x402/PaymentProvider';

import '@rainbow-me/rainbowkit/styles.css';

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'flowx-local-dev';

const wagmiConfig = projectId
  ? getDefaultConfig({
      appName: 'FlowX',
      projectId,
      chains: [xLayer],
      transports: {
        [xLayer.id]: http(),
      },
      ssr: true,
    })
  : createConfig({
      chains: [xLayer],
      transports: { [xLayer.id]: http() },
      ssr: true,
    });

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            gcTime: 5 * 60_000,
            retry: 2,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
          },
          mutations: { retry: 1 },
        },
      }),
  );

  // `reconnectOnMount={false}` stops wagmi from silently auto-reconnecting
  // via `window.ethereum` on page load. Without this, Rabby (or whichever
  // extension got to `window.ethereum` first) hijacks the connection before
  // the user gets to pick OKX in the RainbowKit modal — and the user ends
  // up in a connect-disconnect-reconnect loop to actually reach OKX.
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#ffffff',
            accentColorForeground: '#000000',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
        >
          <X402PaymentProvider>{children}</X402PaymentProvider>
        </RainbowKitProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
