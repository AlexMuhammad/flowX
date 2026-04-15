'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

const ORIGIN =
  process.env.NEXT_PUBLIC_FLOWX_API_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') ||
  'http://localhost:3001';

export const FLOWX_ORIGIN = ORIGIN;

// Browser → same-origin /api (proxied by next.config.js rewrites so
// x402 PAYMENT-REQUIRED headers aren't hidden by CORS).
// SSR → absolute backend origin.
const API_BASE =
  typeof window === 'undefined' ? `${ORIGIN.replace(/\/$/, '')}/api` : '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public path: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (err) {
    throw new ApiError(
      0,
      err instanceof Error ? err.message : 'Network request failed',
      path,
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message || 'API request failed', path);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// === Shapes ===
export type StrategyType = 'lp' | 'defi-invest' | 'stake' | 'lend';
export type FlowStatus = 'success' | 'simulated' | 'failed';
export type SolverKind = 'lp-solver' | 'yield-solver' | 'risk-solver';

export interface Intent {
  amount: number;
  token: string;
  targetApy?: number;
  risk?: 'low' | 'medium' | 'high';
  [k: string]: unknown;
}

export interface FlowExecution {
  status: FlowStatus;
  strategyType: StrategyType;
  protocol: string;
  projectedApy: number;
  amount: number;
  token: string;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
}

export interface SolverBid {
  solver: string;
  projectedApy: number;
  confidence: number;
  riskScore: number;
  strategy?: { type: string; protocol: string };
}

export interface FullFlowResponse {
  intentId?: string;
  intent?: Intent;
  competition?: {
    winner: SolverBid;
    allBids?: SolverBid[];
    competitionDuration?: number;
  };
  execution: FlowExecution;
  totalDurationMs?: number;
}

export interface ExecutionLogEntry {
  id?: string;
  strategyType?: StrategyType;
  protocol: string;
  txHash?: string;
  explorerUrl?: string;
  projectedApy: number;
  amount: number;
  token: string;
  createdAt?: string;
  status?: FlowStatus;
  solver?: string;
}

export interface FlowXEvent {
  id?: string;
  type?: string;
  category?: string;
  message: string;
  data?: Record<string, unknown> & {
    solver?: string;
    protocol?: string;
    strategyType?: string;
    amount?: number;
    token?: string;
  };
  txHash?: string;
  createdAt?: string;
}

// === Fetchers ===
export async function parseIntent(text: string): Promise<Intent> {
  const res = await request<{ intent?: Intent } & Intent>('/intent/parse', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  // Backend historically returns either the intent directly or wrapped under `.intent`.
  return (res as { intent?: Intent }).intent ?? (res as Intent);
}

export async function postFlow(
  text: string,
  x402Fetch: (url: string, init: RequestInit) => Promise<Response>,
): Promise<FullFlowResponse> {
  const res = await x402Fetch('/api/flow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message || 'Flow failed', '/api/flow');
  }
  return (await res.json()) as FullFlowResponse;
}

export function useExecuteLog() {
  return useQuery<ExecutionLogEntry[], ApiError>({
    queryKey: ['execute-log'],
    queryFn: () => request<ExecutionLogEntry[]>('/execute/log'),
    refetchInterval: 15_000,
  });
}

// === Socket.IO live feed (for /activity only) ===
export function useActivityFeed(initial: FlowXEvent[] = []) {
  const [events, setEvents] = useState<FlowXEvent[]>(initial);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const push = useCallback((event: FlowXEvent) => {
    setEvents((prev) => {
      const id = event.id ?? `${event.createdAt ?? Date.now()}-${event.message}`;
      if (prev.some((e) => (e.id ?? e.createdAt) === id)) return prev;
      return [{ ...event, id }, ...prev].slice(0, 20);
    });
  }, []);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_FLOWX_WS_URL || `${FLOWX_ORIGIN}/dashboard`;
    const socket = io(wsUrl, {
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1500,
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('flowx.event', push);
    socket.on('flowxEvent', push);
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [push]);

  return { events, connected };
}

// === Initial activity fetch — falls back to /events if the backend has it ===
export function useInitialActivity() {
  return useQuery<FlowXEvent[], ApiError>({
    queryKey: ['activity-initial'],
    queryFn: async () => {
      try {
        return await request<FlowXEvent[]>('/events?limit=20');
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}
