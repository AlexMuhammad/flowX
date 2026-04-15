export function formatUsd(n: number, opts: { decimals?: number } = {}) {
  const { decimals = 0 } = opts;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatNumber(n: number, decimals = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(n: number, decimals = 1) {
  return `${n.toFixed(decimals)}%`;
}

export function formatDelta(n: number, unit: "usd" | "percent" = "usd") {
  const sign = n >= 0 ? "+" : "";
  if (unit === "percent") return `${sign}${n.toFixed(2)}%`;
  return `${sign}${formatUsd(n, { decimals: n < 100 ? 2 : 0 })}`;
}

export function truncateAddress(addr: string, chars = 4) {
  if (!addr) return "";
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

export function xLayerTxUrl(hash: string) {
  return `https://www.okx.com/web3/explorer/xlayer/tx/${hash}`;
}

export function relativeTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// === New helpers for the React Query dashboard ===

export function formatCurrency(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompact(n: number) {
  if (Math.abs(n) >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatRelativeTime(date: string | number | Date) {
  const ts =
    typeof date === "number" ? date : new Date(date).getTime();
  if (Number.isNaN(ts)) return "";
  return relativeTime(ts);
}

export function explorerTxUrl(hash: string) {
  const base =
    process.env.NEXT_PUBLIC_XLAYER_EXPLORER ||
    "https://www.okx.com/web3/explorer/xlayer";
  return `${base}/tx/${hash}`;
}
