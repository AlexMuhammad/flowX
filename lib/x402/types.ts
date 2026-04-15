// Shape of the base64-decoded PAYMENT-REQUIRED header.
// Mirrors @okxweb3/x402-core `PaymentRequired`.

export interface PaymentRequirement {
  scheme: string; // "aggr_deferred" | "exact" | ...
  network: string; // "eip155:196"
  asset: string; // USDG address
  amount: string; // atomic units (USDG has 6 decimals)
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown> & { name?: string; version?: string };
}

export interface ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
}

export interface PaymentRequired {
  x402Version: number;
  error?: string;
  resource: ResourceInfo;
  accepts: PaymentRequirement[];
  extensions?: Record<string, unknown>;
}

// Decoded from PAYMENT-REQUIRED header.
export function decodePaymentRequired(headerValue: string): PaymentRequired {
  // Support both base64 (expected) and raw JSON for resilience.
  try {
    const json = typeof atob === 'function' ? atob(headerValue) : '';
    return JSON.parse(json) as PaymentRequired;
  } catch {
    return JSON.parse(headerValue) as PaymentRequired;
  }
}

export interface SignedPaymentPayload {
  x402Version: number;
  resource: ResourceInfo;
  accepted: PaymentRequirement;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export function encodePaymentSignature(payload: SignedPaymentPayload): string {
  const json = JSON.stringify(payload);
  return typeof btoa === 'function'
    ? btoa(json)
    : Buffer.from(json).toString('base64');
}

// USDG on X Layer has 6 decimals.
export function formatUsdgAmount(atomic: string, decimals = 6): string {
  const n = Number(atomic) / 10 ** decimals;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function networkChainId(network: string): number | null {
  const m = /^eip155:(\d+)$/.exec(network);
  return m ? Number(m[1]) : null;
}
