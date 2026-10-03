# Outpick

Monorepo: Next.js 15 web (`apps/web`) + FastAPI (`apps/api`) + worker (`apps/worker`).

- **Auth**: BetterAuth + Postgres (web)
- **Portfolio**: Virtual book in Postgres — no Alpaca
- **Strategy**: Run 118 in `packages/strategy` (shared evaluate())
- **Data**: FMP (fundamentals + marks + headcount); job openings from free ATS feeds — see `docs/WORKFORCE_DATA.md`
- **Payments**: Stripe Checkout, Billing, Tax, and Customer Portal
- **Styling**: Tailwind, Outfit (text) + IBM Plex Mono (numerals), dark theme
