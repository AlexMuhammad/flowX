'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  formatUsdgAmount,
  type PaymentRequired,
  type SignedPaymentPayload,
} from '@/lib/x402/types';
import { pickRequirement } from '@/lib/x402/sign';
import type { SigningState } from './PaymentProvider';

interface PendingApproval {
  req: PaymentRequired;
  resourceUrl: string;
  resolve: (payload: SignedPaymentPayload) => void;
  reject: (err: unknown) => void;
}

interface Props {
  pending: PendingApproval | null;
  signing: SigningState;
  error: string | null;
  onApprove: () => void;
  onCancel: () => void;
}

export default function PaymentModal({
  pending,
  signing,
  error,
  onApprove,
  onCancel,
}: Props) {
  const { isConnected } = useAccount();

  const open = !!pending;
  const req = pending?.req;
  const accepted = req ? pickRequirement(req) : null;
  const tokenName = (accepted?.extra?.name as string | undefined) ?? 'USDG';
  const price = accepted ? formatUsdgAmount(accepted.amount, 6) : '—';

  const isWorking = signing !== 'idle';

  return (
    <AnimatePresence>
      {open && req && accepted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={isWorking ? undefined : onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-black p-8"
          >
            {!isWorking && (
              <button
                onClick={onCancel}
                className="absolute right-4 top-4 rounded-md p-1.5 text-white/40 transition hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Powered by x402
              </div>
              <div className="mt-6 font-mono text-5xl font-semibold tracking-tight text-white">
                {price}
              </div>
              <div className="mt-2 font-mono text-xs text-white/50">
                {tokenName}
              </div>
              <p className="mt-6 text-sm leading-relaxed text-white/60">
                Sign once to unlock the flow. No gas, no onchain tx from your
                wallet.
              </p>
            </div>

            {error && (
              <div className="mt-6 rounded-lg border border-white/25 bg-white/5 px-3 py-2 text-[11px] text-white/80">
                {error}
              </div>
            )}

            {!isConnected ? (
              <div className="mt-8 flex flex-col items-center gap-3">
                <ConnectButton showBalance={false} chainStatus="none" />
                <button
                  onClick={onCancel}
                  className="text-xs text-white/40 transition hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={onApprove}
                  disabled={isWorking}
                  className={clsx(
                    'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-black transition',
                    'bg-white hover:bg-white/90',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {signing === 'switching' && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Switching chain…
                    </>
                  )}
                  {signing === 'signing' && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing…
                    </>
                  )}
                  {signing === 'idle' && <>Approve &amp; sign</>}
                </button>
                <button
                  onClick={onCancel}
                  disabled={isWorking}
                  className="text-center text-xs text-white/40 transition hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
