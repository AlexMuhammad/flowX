/** @type {import('next').NextConfig} */
const BACKEND =
  process.env.NEXT_PUBLIC_FLOWX_API_URL || 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  // Proxy /api/* to the FlowX backend so the browser sees same-origin
  // responses. This avoids CORS header-exposure restrictions on custom
  // headers like PAYMENT-REQUIRED (the x402 payment challenge).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
