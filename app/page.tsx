'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useX402Fetch } from '@/components/x402/PaymentProvider';
import {
  postFlow,
  type FullFlowResponse,
  type SolverBid,
} from '@/lib/api';
import { explorerTxUrl, truncateAddress } from '@/lib/format';

type Phase =
  | 'idle'
  | 'parsing'
  | 'competing'
  | 'winner'
  | 'executing'
  | 'done'
  | 'error';

const PLACEHOLDER = 'Deploy 1 USDC for best yield, low risk';

function strategyLabel(protocol: string) {
  if (/aave/i.test(protocol)) return 'Lending';
  if (/okx|uniswap|dex/i.test(protocol)) return 'DEX routing';
  return 'Strategy';
}

export default function HomePage() {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<FullFlowResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const x402Fetch = useX402Fetch();

  const mutation = useMutation<FullFlowResponse, Error, string>({
    mutationFn: async (t: string) => {
      setPhase('parsing');
      const advance = window.setTimeout(() => setPhase('competing'), 800);
      const advance2 = window.setTimeout(() => setPhase('executing'), 2800);
      try {
        const data = await postFlow(t, x402Fetch);
        return data;
      } finally {
        window.clearTimeout(advance);
        window.clearTimeout(advance2);
      }
    },
    onSuccess: (data) => {
      setResult(data);
      setPhase(data.execution.status === 'failed' ? 'error' : 'done');
      setErrorMsg(data.execution.error ?? null);
    },
    onError: (err) => {
      setPhase('error');
      setErrorMsg(err.message);
    },
  });

  const onDeploy = () => {
    const t = text.trim() || PLACEHOLDER;
    setErrorMsg(null);
    setResult(null);
    mutation.mutate(t);
  };

  const reset = () => {
    setPhase('idle');
    setResult(null);
    setErrorMsg(null);
    mutation.reset();
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-2xl flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Intent-driven liquidity on X Layer
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Describe what you want. Three AI solvers compete. The winner runs on
          X Layer mainnet.
        </p>
      </div>

      {phase === 'idle' && (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={PLACEHOLDER}
            className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.02] px-5 py-4 text-lg text-white placeholder:text-white/30 outline-none transition focus:border-white/50"
          />
          <button
            onClick={onDeploy}
            className="mt-4 w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            Deploy
          </button>
          <p className="mt-3 text-[11px] text-white/40">
            Runs on X Layer mainnet · $0.05 USDG access fee via x402 · real
            funds may move.
          </p>
        </div>
      )}

      {phase !== 'idle' && (
        <ResultCard
          phase={phase}
          text={text.trim() || PLACEHOLDER}
          result={result}
          errorMsg={errorMsg}
          onReset={reset}
        />
      )}
    </div>
  );
}

function ResultCard({
  phase,
  text,
  result,
  errorMsg,
  onReset,
}: {
  phase: Phase;
  text: string;
  result: FullFlowResponse | null;
  errorMsg: string | null;
  onReset: () => void;
}) {
  const winner: SolverBid | undefined = result?.competition?.winner;
  const exec = result?.execution;

  return (
    <div className="space-y-5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">
        Intent
      </div>
      <div className="text-base text-white/90">{text}</div>

      <div className="h-px bg-white/10" />

      {phase === 'parsing' && (
        <Line>
          <Spinner /> Understanding intent…
        </Line>
      )}

      {phase === 'competing' && (
        <div className="space-y-3">
          <Line>
            <Spinner /> Competing
          </Line>
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-white/60">
            <SolverDot name="lp-solver" />
            <SolverDot name="yield-solver" />
            <SolverDot name="risk-solver" />
          </div>
        </div>
      )}

      {phase === 'winner' && winner && (
        <Line>
          <span className="font-mono text-white">{winner.solver}</span> ·{' '}
          {winner.strategy?.protocol ?? '—'} · projected{' '}
          {winner.projectedApy.toFixed(3)}% APY
        </Line>
      )}

      {phase === 'executing' && (
        <Line>
          <Spinner /> Signing transaction on X Layer…
        </Line>
      )}

      {phase === 'done' && exec && (
        <DoneView result={result!} onReset={onReset} />
      )}

      {phase === 'error' && (
        <div className="space-y-4">
          <div className="text-sm text-white/80">
            {errorMsg || 'Flow failed.'}
          </div>
          <button
            onClick={onReset}
            className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function DoneView({
  result,
  onReset,
}: {
  result: FullFlowResponse;
  onReset: () => void;
}) {
  const exec = result.execution;
  const winner = result.competition?.winner;
  const label = strategyLabel(exec.protocol);
  const short = exec.txHash ? truncateAddress(exec.txHash, 4) : null;
  const url =
    exec.explorerUrl ?? (exec.txHash ? explorerTxUrl(exec.txHash) : null);

  return (
    <div className="space-y-5">
      {winner && (
        <div className="text-sm text-white/80">
          <span className="font-mono text-white">{winner.solver}</span> ·{' '}
          {exec.protocol} · projected {exec.projectedApy.toFixed(3)}% APY
        </div>
      )}

      <div className="space-y-2 text-sm text-white/70">
        <Row label="Strategy">
          <span className="text-white">{exec.protocol}</span>
          <span className="ml-2 rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            {label}
          </span>
        </Row>
        <Row label="Amount">
          <span className="font-mono text-white">
            {exec.amount} {exec.token}
          </span>
        </Row>
        {short && url && (
          <Row label="Tx">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              {short} ↗
            </a>
          </Row>
        )}
      </div>

      <p className="text-sm leading-relaxed text-white/60">
        Your capital now earns{' '}
        {label === 'Lending' ? 'Aave supply APY' : 'routed DEX liquidity'},
        live on X Layer mainnet.
      </p>

      <button
        onClick={onReset}
        className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60 transition hover:text-white"
      >
        Deploy another →
      </button>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 font-mono text-sm text-white/80">
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-20 text-[11px] uppercase tracking-[0.14em] text-white/30">
        {label}
      </span>
      <span className="flex items-center">{children}</span>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white" />
  );
}

function SolverDot({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      {name}
    </span>
  );
}
