# Outpick

> Intentional investing beyond the index.

A stock research team publishing a live portfolio, full research notes, and transparent performance for investors who outgrew index funds.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + IBM Plex Mono/Sans
- **Auth**: BetterAuth (self-hosted)
- **Database**: Convex (real-time, serverless)
- **Payments**: Paddle (merchant of record — handles taxes/compliance)
- **Deployment**: Vercel or Cloudflare Pages

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd outpick
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

This will create your Convex project and deploy the schema. Copy the deployment URL.

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_CONVEX_URL` — from Convex dashboard
- `BETTER_AUTH_SECRET` — generate with `openssl rand -hex 32`
- `BETTER_AUTH_URL` — your app URL
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` — from Paddle dashboard
- `NEXT_PUBLIC_PADDLE_PRICE_ID` — create a $1,000/yr product in Paddle
- `NEXT_PUBLIC_PADDLE_FOUNDERS_PRICE_ID` — $250/yr founders price; charged at checkout while the founders deal is active (falls back to the standard price if unset)
- `PADDLE_API_KEY` — from Paddle dashboard
- `PADDLE_WEBHOOK_SECRET` — from Paddle webhook settings

### 4. Set up Paddle

1. Create a Paddle account at [paddle.com](https://paddle.com)
2. Create a product: "Outpick — Annual Membership"
3. Create a price: $1,000 USD / year, recurring
4. Copy the Price ID to `NEXT_PUBLIC_PADDLE_PRICE_ID`
5. (Optional) Create a second price: $250 USD / year, recurring, and copy its
   Price ID to `NEXT_PUBLIC_PADDLE_FOUNDERS_PRICE_ID`. Checkout uses this while
   the founders deal is active (through Day 150 of the live portfolio).
6. Set up webhook endpoint: `https://yourdomain.com/api/webhooks/paddle`
7. Subscribe to events: `subscription.created`, `subscription.activated`, `subscription.canceled`, `subscription.past_due`, `subscription.updated`

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout
│   ├── dashboard/
│   │   └── page.tsx                # Authenticated dashboard
│   ├── terms/
│   │   └── page.tsx                # Terms of Service
│   ├── privacy/
│   │   └── page.tsx                # Privacy Policy
│   └── api/
│       ├── auth/[...all]/route.ts  # BetterAuth handler
│       └── webhooks/paddle/route.ts # Paddle webhooks
├── components/
│   ├── landing/                    # Landing page sections
│   ├── dashboard/                  # Dashboard components
│   └── layout/                     # Navbar, Footer, Cookie Banner
├── lib/
│   ├── auth.ts                     # BetterAuth server config
│   ├── auth-client.ts              # BetterAuth client
│   ├── constants.ts                # Site config & stats
│   ├── paddle.ts                   # Paddle checkout helper
│   └── utils.ts                    # Utility functions
└── styles/
    └── globals.css                 # Tailwind + custom styles

convex/
├── schema.ts                       # Database schema
├── queries.ts                      # Read functions
└── mutations.ts                    # Write functions
```

## Deployment

### Vercel (recommended)
```bash
npm i -g vercel
vercel
```

### Cloudflare Pages
```bash
npm install @cloudflare/next-on-pages
npx @cloudflare/next-on-pages
```

## Legal

This project includes:
- **Terms of Service** (`/terms`) — not-investment-advice disclaimer, publisher's exclusion language, no-reliance clause, conflicts of interest disclosure, assumption of risk, subscription terms, liability limitations, indemnification, class action waiver, arbitration
- **Privacy Policy** (`/privacy`) — covers data collection, cookies, third-party services (Paddle, Convex), data retention, user rights
- **Cookie consent banner** — GDPR-compliant with accept/decline
- **Prominent disclaimer** on landing page with conflicts of interest disclosure

### Before launching

1. **Have a securities attorney review your Terms** — Confirm your setup qualifies for the publisher/newsletter exclusion under the Investment Advisers Act of 1940. Budget ~$300–500 for a focused review.
2. **Set up Paddle** — Configure billing and tax handling as merchant of record.
3. **Review all legal pages with counsel** — The included Terms and Privacy Policy are comprehensive starting points but should be reviewed for your specific situation.

## Data Flow

Your existing backend → Convex (via mutations API) → Dashboard (real-time via queries)

The dashboard reads from Convex in real-time. Your backend pushes updates via Convex mutations (new picks, status changes, performance snapshots). Paddle handles all payment/tax operations.
