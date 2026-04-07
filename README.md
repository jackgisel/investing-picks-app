# Outpick

> Outperform the index. Keep your day job.

A subscription-based stock picks dashboard and research publication.

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
- `PADDLE_API_KEY` — from Paddle dashboard
- `PADDLE_WEBHOOK_SECRET` — from Paddle webhook settings

### 4. Set up Paddle

1. Create a Paddle account at [paddle.com](https://paddle.com)
2. Create a product: "Outpick — Annual Membership"
3. Create a price: $1,000 USD / year, recurring
4. Copy the Price ID to your env
5. Set up webhook endpoint: `https://yourdomain.com/api/webhooks/paddle`
6. Subscribe to events: `subscription.created`, `subscription.activated`, `subscription.canceled`, `subscription.past_due`, `subscription.updated`

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
- **Terms of Service** (`/terms`) — Wyoming LLC entity, not-investment-advice disclaimer, publisher's exclusion language, conflicts of interest disclosure, assumption of risk, subscription terms, liability limitations, class action waiver, Wyoming governing law
- **Privacy Policy** (`/privacy`) — covers data collection, cookies, third-party services (Paddle, Convex), data retention, user rights
- **Cookie consent banner** — GDPR-compliant with accept/decline
- **Prominent disclaimer** on landing page with conflicts of interest disclosure

### Before launching

1. **Form a Wyoming LLC** — Use [Northwest Registered Agent](https://www.northwestregisteredagent.com) (~$39 + $100 state fee). They handle filing, provide a business address (keeps your home address private), and act as your registered agent. Ongoing: ~$125/yr (agent) + ~$60/yr (Wyoming annual report) = ~$185/yr total.
2. **Get an EIN** — Free from IRS.gov. Takes 5 minutes. You'll need this for Paddle and a business bank account.
3. **Open a business bank account** — Keep business and personal finances separate. Use Mercury, Relay, or any bank that supports LLCs.
4. **Set up Paddle under the LLC** — Register the LLC as the merchant entity so your personal name never appears on billing.
5. **Consult a securities attorney** — 30-min call to confirm your specific setup qualifies for the publisher/newsletter exclusion under the Investment Advisers Act of 1940. Budget ~$300-500.
6. **Review all legal pages** with the attorney — the included Terms of Service and Privacy Policy are comprehensive starting points but should be reviewed by counsel for your specific situation.

## Data Flow

Your existing backend → Convex (via mutations API) → Dashboard (real-time via queries)

The dashboard reads from Convex in real-time. Your backend pushes updates via Convex mutations (new picks, status changes, performance snapshots). Paddle handles all payment/tax operations.
