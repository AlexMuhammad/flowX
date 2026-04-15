'use client';

import {
  useActivityFeed,
  useInitialActivity,
  type FlowXEvent,
} from '@/lib/api';
import { explorerTxUrl, formatRelativeTime, truncateAddress } from '@/lib/format';

function solverLabel(name: string | undefined) {
  if (!name) return 'Event';
  if (name.includes('lp')) return 'DEX routing';
  if (name.includes('yield')) return 'Lending';
  if (name.includes('risk')) return 'Risk gate';
  return 'Solver';
}

export default function ActivityPage() {
  const { data: initial } = useInitialActivity();
  const { events, connected } = useActivityFeed();

  const merged = events.length > 0 ? events : (initial ?? []).slice(0, 20);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Activity
        </h1>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-white' : 'bg-white/20'
            }`}
          />
          {connected ? 'live' : 'offline'}
        </span>
      </div>
      <p className="mt-1 text-sm text-white/50">
        Every FlowX execution, from every user, in real time.
      </p>

      <ul className="mt-8 space-y-3">
        {merged.length === 0 ? (
          <li className="text-sm text-white/40">No activity yet.</li>
        ) : (
          merged.map((event, i) => (
            <EventRow key={event.id ?? i} event={event} />
          ))
        )}
      </ul>
    </div>
  );
}

function EventRow({ event }: { event: FlowXEvent }) {
  const data = event.data ?? {};
  const solver = data.solver as string | undefined;
  const label = solverLabel(solver);
  const protocol = (data.protocol as string | undefined) ?? event.message;
  const amount = data.amount as number | undefined;
  const token = (data.token as string | undefined) ?? 'USDT';
  const when = event.createdAt ? formatRelativeTime(event.createdAt) : '';
  const txHash = event.txHash;
  const explorer = txHash ? explorerTxUrl(txHash) : null;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
      {when && <span className="text-white/30">{when}</span>}
      {solver && (
        <>
          <span>·</span>
          <span className="font-mono text-white">{solver}</span>
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            {label}
          </span>
        </>
      )}
      {protocol && (
        <>
          <span>·</span>
          <span className="text-white/80">{protocol}</span>
        </>
      )}
      {amount !== undefined && (
        <>
          <span>·</span>
          <span className="font-mono text-white/70">
            {amount} {token}
          </span>
        </>
      )}
      {explorer && txHash && (
        <>
          <span>·</span>
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
          >
            {truncateAddress(txHash, 4)} ↗
          </a>
        </>
      )}
    </li>
  );
}
