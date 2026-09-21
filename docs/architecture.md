# ArbiScan architecture

Web: React/Vite/Tailwind -> Cloudflare Pages. API: Cloudflare Workers. Database: Supabase PostgreSQL. Scheduled collection: Workers Cron + Queue.

ChatGPT/MCP is a development assistant, not a production dependency.

Data flow: marketplace connector -> normalized listing -> product matching -> Korean listing -> deterministic cost calculation -> arbitrage opportunity -> watchlist/alert.

AI handles normalization/matching/risk-text extraction. Money, FX, tax, shipping, fees, profit and ROI stay deterministic in code.
