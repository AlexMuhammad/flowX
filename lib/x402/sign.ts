import type {
  PaymentRequired,
  PaymentRequirement,
  SignedPaymentPayload,
} from './types';

// Pick the best scheme we can sign. `aggr_deferred` requires a pre-issued
// session-key cert which RainbowKit/wagmi don't set up, so fall back to
// `exact` (EIP-3009 TransferWithAuthorization).
export function pickRequirement(
  req: PaymentRequired,
): PaymentRequirement | null {
  return (
    req.accepts.find((a) => a.scheme === 'exact') ??
    req.accepts[0] ??
    null
  );
}

export interface EIP3009Authorization {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
}

// EIP-712 typed data structure for EIP-3009 TransferWithAuthorization.
export const TransferWithAuthorizationTypes = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

export function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let out = '0x';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out as `0x${string}`;
}

export function buildEip3009Authorization(
  accepted: PaymentRequirement,
  fromAddress: `0x${string}`,
): EIP3009Authorization {
  const now = Math.floor(Date.now() / 1000);
  const ttl = accepted.maxTimeoutSeconds ?? 300;
  return {
    from: fromAddress,
    to: accepted.payTo as `0x${string}`,
    value: accepted.amount,
    validAfter: '0',
    validBefore: String(now + ttl),
    nonce: randomNonce(),
  };
}

export function assembleSignedPayload(
  req: PaymentRequired,
  accepted: PaymentRequirement,
  authorization: EIP3009Authorization,
  signature: `0x${string}`,
): SignedPaymentPayload {
  return {
    x402Version: req.x402Version,
    resource: req.resource,
    accepted,
    payload: { signature, authorization },
    extensions: req.extensions,
  };
}
