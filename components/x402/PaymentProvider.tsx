'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useAccount,
  useChainId,
  useSignTypedData,
  useSwitchChain,
} from 'wagmi';
import { createPublicClient, erc20Abi, http } from 'viem';
import { xLayer } from 'viem/chains';

// Read-only client to verify the token's actual EIP-712 domain name
// (some facilitators advertise a different `extra.name` in the 402 challenge
// than what the token's DOMAIN_SEPARATOR was computed with — e.g. USDG on
// X Layer reports "Global Dollar" on-chain but x402 advertises "USDG").
const publicClient = createPublicClient({
  chain: xLayer,
  transport: http(),
});
import { x402Fetch, type X402Approver } from '@/lib/x402/fetch';
import {
  assembleSignedPayload,
  buildEip3009Authorization,
  pickRequirement,
  TransferWithAuthorizationTypes,
} from '@/lib/x402/sign';
import {
  networkChainId,
  type PaymentRequired,
  type SignedPaymentPayload,
} from '@/lib/x402/types';
import PaymentModal from './PaymentModal';

interface PendingApproval {
  req: PaymentRequired;
  resourceUrl: string;
  resolve: (payload: SignedPaymentPayload) => void;
  reject: (err: unknown) => void;
}

export type SigningState = 'idle' | 'switching' | 'signing';

interface X402ContextValue {
  x402Fetch: (url: string, init: RequestInit) => Promise<Response>;
}

const X402Context = createContext<X402ContextValue | null>(null);

export function X402PaymentProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();

  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [signing, setSigning] = useState<SigningState>('idle');
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<PendingApproval | null>(null);
  pendingRef.current = pending;

  const requestApproval = useCallback<X402Approver>((req, resourceUrl) => {
    return new Promise<SignedPaymentPayload>((resolve, reject) => {
      setError(null);
      setSigning('idle');
      setPending({ req, resourceUrl, resolve, reject });
    });
  }, []);

  const wrappedFetch = useCallback(
    (url: string, init: RequestInit) =>
      x402Fetch(url, { ...init, approve: requestApproval }),
    [requestApproval],
  );

  const handleApprove = useCallback(async () => {
    const current = pendingRef.current;
    console.log('[x402] handleApprove fired', {
      hasPending: !!current,
      isConnected,
      address,
      chainId,
    });
    if (!current) return;
    setError(null);

    if (!isConnected || !address) {
      setError('Connect a wallet before approving the payment.');
      return;
    }

    const accepted = pickRequirement(current.req);
    if (!accepted) {
      setError('No supported payment scheme offered by the server.');
      return;
    }
    if (accepted.scheme !== 'exact') {
      setError(
        `Scheme "${accepted.scheme}" is not supported in the browser client. Only "exact" (EIP-3009) is implemented.`,
      );
      return;
    }

    const wanted = networkChainId(accepted.network) ?? xLayer.id;

    try {
      if (chainId !== wanted) {
        console.log('[x402] switching chain', chainId, '→', wanted);
        setSigning('switching');
        await switchChainAsync({ chainId: wanted });
        console.log('[x402] chain switched');
      }

      setSigning('signing');
      const authorization = buildEip3009Authorization(accepted, address);
      console.log('[x402] authorization prepared', authorization);

      // Prefer the on-chain token name over whatever the server advertised
      // in `extra.name`. If they differ, the domain separator will mismatch
      // and the facilitator rejects with invalid_signature.
      const advertisedName =
        (accepted.extra?.name as string | undefined) ?? 'USDG';
      let domainName = advertisedName;
      try {
        const onchainName = (await publicClient.readContract({
          address: accepted.asset as `0x${string}`,
          abi: erc20Abi,
          functionName: 'name',
        })) as string;
        if (onchainName && onchainName !== advertisedName) {
          console.warn(
            '[x402] domain name mismatch — using on-chain',
            { advertised: advertisedName, onchain: onchainName },
          );
        }
        domainName = onchainName || advertisedName;
      } catch (e) {
        console.warn('[x402] failed to read token name from chain', e);
      }

      const domain = {
        name: domainName,
        version: (accepted.extra?.version as string) ?? '1',
        chainId: wanted,
        verifyingContract: accepted.asset as `0x${string}`,
      };
      console.log('[x402] signing with domain', domain);

      const signature = await signTypedDataAsync({
        domain,
        types: TransferWithAuthorizationTypes,
        primaryType: 'TransferWithAuthorization',
        message: {
          from: authorization.from,
          to: authorization.to,
          value: BigInt(authorization.value),
          validAfter: BigInt(authorization.validAfter),
          validBefore: BigInt(authorization.validBefore),
          nonce: authorization.nonce,
        },
      });
      console.log('[x402] signTypedData resolved, signature:', signature);

      const signed = assembleSignedPayload(
        current.req,
        accepted,
        authorization,
        signature,
      );
      console.log('[x402] resolving approver promise with signed payload');
      current.resolve(signed);
      setPending(null);
      setSigning('idle');
    } catch (err) {
      console.error('[x402] signing failed', err);
      const msg =
        err instanceof Error ? err.message : 'Payment signing failed';
      setError(msg);
      setSigning('idle');
    }
  }, [address, isConnected, chainId, switchChainAsync, signTypedDataAsync]);

  const handleCancel = useCallback(() => {
    const current = pendingRef.current;
    if (!current) return;
    current.reject(new Error('Payment cancelled by user'));
    setPending(null);
    setSigning('idle');
    setError(null);
  }, []);

  const value = useMemo<X402ContextValue>(
    () => ({ x402Fetch: wrappedFetch }),
    [wrappedFetch],
  );

  return (
    <X402Context.Provider value={value}>
      {children}
      <PaymentModal
        pending={pending}
        signing={signing}
        error={error}
        onApprove={handleApprove}
        onCancel={handleCancel}
      />
    </X402Context.Provider>
  );
}

export function useX402Fetch() {
  const ctx = useContext(X402Context);
  if (!ctx) {
    throw new Error('useX402Fetch must be used inside <X402PaymentProvider>');
  }
  return ctx.x402Fetch;
}
