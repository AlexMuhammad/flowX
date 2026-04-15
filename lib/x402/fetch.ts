import {
  decodePaymentRequired,
  encodePaymentSignature,
  type PaymentRequired,
  type SignedPaymentPayload,
} from './types';

const PAYMENT_REQUIRED_HEADER = 'payment-required';
const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE';

export type X402Approver = (
  req: PaymentRequired,
  resourceUrl: string,
) => Promise<SignedPaymentPayload>;

export interface X402FetchOptions extends RequestInit {
  /** Called when the server returns 402. Must resolve with a signed payload or reject. */
  approve: X402Approver;
}

/**
 * Fetch wrapper that transparently handles x402 payment challenges.
 *
 * Flow:
 *   1. Fires the request normally.
 *   2. If the server returns 402 with a PAYMENT-REQUIRED header, decodes it,
 *      calls `approve()` to let the user inspect and sign, then replays the
 *      request with a PAYMENT-SIGNATURE header.
 *   3. Returns the final response. If the replay also returns 402 we give up
 *      (no retry loop) and surface the response to the caller.
 */
export async function x402Fetch(
  url: string,
  options: X402FetchOptions,
): Promise<Response> {
  const { approve, ...init } = options;

  console.log('[x402] → fetch', url);
  const first = await fetch(url, init);
  console.log('[x402] ← first status', first.status);
  if (first.status !== 402) return first;

  const headerValue =
    first.headers.get(PAYMENT_REQUIRED_HEADER) ||
    first.headers.get('PAYMENT-REQUIRED') ||
    first.headers.get('Payment-Required');

  if (!headerValue) {
    console.error('[x402] 402 response missing PAYMENT-REQUIRED header', [
      ...first.headers.entries(),
    ]);
    throw new Error(
      '402 response missing PAYMENT-REQUIRED header — cannot sign payment.',
    );
  }

  let decoded: PaymentRequired;
  try {
    decoded = decodePaymentRequired(headerValue);
    console.log('[x402] decoded', decoded);
  } catch (err) {
    console.error('[x402] header decode failed', err);
    throw new Error(
      `Failed to decode PAYMENT-REQUIRED header: ${(err as Error).message}`,
    );
  }

  console.log('[x402] waiting for user approval…');
  let signedPayload;
  try {
    signedPayload = await approve(decoded, url);
  } catch (err) {
    console.error('[x402] approval rejected', err);
    throw err;
  }
  console.log('[x402] got signed payload', signedPayload);

  let headerOut: string;
  try {
    headerOut = encodePaymentSignature(signedPayload);
  } catch (err) {
    console.error('[x402] failed to encode PAYMENT-SIGNATURE header', err);
    throw err;
  }
  console.log('[x402] header length', headerOut.length);

  const replayInit: RequestInit = {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      [PAYMENT_SIGNATURE_HEADER]: headerOut,
    },
  };

  console.log('[x402] → replay fetch with PAYMENT-SIGNATURE');
  const replay = await fetch(url, replayInit);
  console.log('[x402] ← replay status', replay.status);
  if (replay.status === 402) {
    // Surface the server's error so we can see why the signature was rejected.
    const retryHdr =
      replay.headers.get(PAYMENT_REQUIRED_HEADER) ||
      replay.headers.get('PAYMENT-REQUIRED');
    if (retryHdr) {
      try {
        console.warn('[x402] replay challenge', decodePaymentRequired(retryHdr));
      } catch {
        /* ignore */
      }
    }
    const body = await replay.clone().text();
    console.warn('[x402] replay body', body);
  }
  return replay;
}
