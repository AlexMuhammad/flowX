'use client';

import { useAccount } from 'wagmi';
import { useExecuteLog, type ExecutionLogEntry } from '@/lib/api';
import { explorerTxUrl, truncateAddress } from '@/lib/format';

export default function PositionsPage() {
  const { isConnected } = useAccount();
  const { data, isLoading } = useExecuteLog();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Positions
      </h1>
      <p className="mt-1 text-sm text-white/50">
        Every successful FlowX execution, live from X Layer.
      </p>

      <div className="mt-8">
        {!isConnected ? (
          <p className="text-sm text-white/50">
            Connect wallet to view your positions.
          </p>
        ) : isLoading ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-white/40">No positions yet.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {data.map((entry, i) => (
              <PositionRow key={entry.id ?? i} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PositionRow({ entry }: { entry: ExecutionLogEntry }) {
  const url =
    entry.explorerUrl ?? (entry.txHash ? explorerTxUrl(entry.txHash) : null);
  return (
    <li className="flex items-center justify-between gap-4 py-4 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-white">{entry.protocol}</span>
        <span className="font-mono text-white/60">· {entry.token}</span>
      </div>
      <div className="flex items-center gap-6 font-mono text-xs text-white/60">
        <span className="text-white/80">
          {entry.amount} {entry.token}
        </span>
        <span>~{entry.projectedApy.toFixed(3)}% APY</span>
        {url && entry.txHash && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
          >
            {truncateAddress(entry.txHash, 4)} ↗
          </a>
        )}
      </div>
    </li>
  );
}
