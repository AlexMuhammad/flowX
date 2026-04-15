# FlowX Dashboard

Intent-driven liquidity engine for OKX X Layer.

## Run

```bash
pnpm install
pnpm dev
```

Opens at http://localhost:3000.

Works standalone with realistic mock data. If a backend is running on
`http://localhost:3001` exposing `/api/snapshot` and `/api/intents`, the
dashboard will use live data automatically.
