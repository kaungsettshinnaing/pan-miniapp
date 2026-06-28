# PAN Platform — Architecture & Deployment Reference

Pyan Ann Ngwe (ပြန်အမ်းငွေ) is a multi-merchant cashback loyalty platform for Myanmar.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16.2.9, App Router, React 19 |
| Database | PostgreSQL via Docker |
| ORM | Prisma 7.8.0 with `@prisma/adapter-pg` (adapter-based, no `url` in schema.prisma) |
| Auth | Telegram initData HMAC-SHA256 **or** httpOnly JWT cookie (jose) |
| Passwords | bcryptjs (cost 12) |
| Styling | Tailwind CSS v4 with `@theme` directive |
| Hosting | Hostinger VPS, Docker + Traefik (SSL via Let's Encrypt) |
| CI/CD | GitHub Actions → SSH deploy |
| Notifications | n8n webhooks (fire-and-forget after DB commit) |

### Prisma 7 key differences from v5/v6
- No `url = env("DATABASE_URL")` in `schema.prisma` datasource — URL lives in `prisma.config.ts`
- Client initialized with adapter: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })`
- Generated client is TypeScript source at `app/generated/prisma/`
- Import: `import { PrismaClient } from "@/app/generated/prisma/client"` (not the package root)

---

## Dual-Channel Resilience

Myanmar internet blocking can take down VPS-hosted sites. Both channels read/write the **same PostgreSQL** — no sync needed.

```
Channel A: Telegram bot text flow
  └── n8n (separate hosting) → reads/writes Next.js API on VPS
  └── handles /balance, merchant code, /redeem text commands
  └── scheduled: expiry reminders, win-back campaigns

Channel B: Telegram Mini App + Web portals
  └── Next.js on app.cashbackapp.cloud (Hostinger VPS)
  └── Customer mini app, Merchant web, Admin web, CP web

Shared: PostgreSQL on VPS (single source of truth)

Resilience:
  VPS down → Channel A (n8n on different infra) still works
  n8n down → Channel B (mini app + web) still works
```

---

## Environments

| Env | Domain | VPS path | Docker compose |
|-----|--------|----------|----------------|
| UAT | `uat.cashbackapp.cloud` | `/opt/pan-miniapp-uat` | `docker-compose.prod.yml` |
| Production | `app.cashbackapp.cloud` | `/opt/pan-miniapp` | `docker-compose.prod.yml` |

**Deploy trigger:**
- Push to `main` → GitHub Actions → SSH into VPS → UAT path
- Push tag `v*` → Production path

**Deploy steps (automated):**
```bash
git pull origin main
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

---

## Environment Variables (`.env.prod` on VPS)

```env
POSTGRES_USER=pan_user
POSTGRES_PASSWORD=<strong>
POSTGRES_DB=pan_db
DATABASE_URL=                        # built by docker-compose from above three

TELEGRAM_BOT_TOKEN=                  # bot token from BotFather
N8N_WEBHOOK_URL=                     # set via admin panel UI, not here
NEXT_PUBLIC_APP_URL=https://uat.cashbackapp.cloud

ADMIN_TELEGRAM_IDS=                  # optional — comma-separated TG IDs for Telegram admin access
JWT_SECRET=<openssl rand -hex 32>    # required for web login cookies
ADMIN_USERNAME=admin                 # seed creates this admin user on first run
ADMIN_PASSWORD=<strong>

DOMAIN=uat.cashbackapp.cloud
APP_ENV=pan-uat                      # pan-prod for production
```

**Key rule:** `N8N_WEBHOOK_URL` is set via the Admin panel (stored in `PlatformSetting` table), not in `.env.prod`. No redeploy needed to change it.

---

## Traefik Routing

Hostinger VPS has Traefik pre-installed on port 80/443. Do **not** run nginx. The app container exposes port 3000 internally and uses Docker labels to register with Traefik:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.${APP_ENV}.rule=Host(`${DOMAIN}`)"
  - "traefik.http.routers.${APP_ENV}.entrypoints=websecure"
  - "traefik.http.routers.${APP_ENV}.tls.certresolver=letsencrypt"
  - "traefik.http.services.${APP_ENV}.loadbalancer.server.port=3000"
  - "traefik.docker.network=traefik-public"
networks:
  traefik-public:
    external: true   # must be external; Traefik owns this network
```

---

## n8n Integration

n8n fires on two events (fire-and-forget POST after successful DB transaction):

| Trigger | Webhook path | Payload |
|---------|-------------|---------|
| Customer earns cashback (OTP generated) | `/pan-merchant-notify` | `{ customerTelegramID, merchantURL, totalCashback, otpCode, merchantTelegramID }` |
| Redemption processed | `/pan-cashback-issued` | `{ customerTelegramID, merchantURL, redeemedAmt, newCashbackAmt, expiryDate, purchaseAmount }` |

The base URL is read from `PlatformSetting` key `N8N_WEBHOOK_URL` (DB-backed, editable in admin panel without redeploy).

---

## Seeding

```bash
docker compose -f docker-compose.prod.yml exec app npx tsx prisma/seed.ts
```

Seed creates:
- 3 merchants (BerryBooTest 5%, QQHotpotBBQ 10%, Test1 10%)
- 6 sample customers
- 11 cashbacks
- 15 message templates (default per trigger per merchant)
- Admin web user from `ADMIN_USERNAME` + `ADMIN_PASSWORD` env vars

---

## File Map

```
pan-miniapp/
├── app/
│   ├── page.tsx                     Customer home (balance hero, merchant cards, earn/redeem sheets)
│   ├── admin/page.tsx               Admin portal (Settings, Merchants, Users tabs)
│   ├── cp/page.tsx                  Channel Partner portal (Merchants, Activity, Earnings tabs)
│   ├── login/page.tsx               Web login form (redirects by role)
│   ├── layout.tsx                   Loads Telegram WebApp SDK
│   ├── globals.css                  Tailwind v4 theme, custom colors, Myanmar font
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts       POST username+password → JWT cookie
│       │   ├── logout/route.ts      POST → clears cookie
│       │   └── me/route.ts          GET current auth identity
│       ├── balance/route.ts         Customer: GET cashbacks with merchant info
│       ├── earn/route.ts            Customer: POST merchantURL → OTP session
│       ├── redeem/route.ts          Merchant: POST otpCode+purchaseAmount → process redemption
│       ├── profile/route.ts         Customer: GET stats
│       ├── merchants/route.ts       Public: GET merchant info by URL
│       ├── merchant/
│       │   ├── me/route.ts          GET isMerchant + merchant info (Telegram or cookie)
│       │   └── templates/route.ts   GET/PUT message templates
│       ├── admin/
│       │   ├── settings/route.ts    GET/POST platform settings (N8N URL etc.)
│       │   ├── merchants/route.ts   GET all merchants / PATCH any merchant
│       │   ├── web-users/route.ts   GET/POST/PATCH/DELETE web login users
│       │   └── groups/route.ts      GET redemption groups (for dropdowns)
│       └── cp/
│           ├── merchants/route.ts   GET/POST/PATCH CP's merchants
│           ├── activity/route.ts    GET redemptions across CP's merchants
│           └── earnings/route.ts    GET commission × profitSharePct breakdown
├── components/
│   ├── BalanceHero.tsx              Total balance card with merchant/expiry badges
│   ├── MerchantCard.tsx             Per-merchant cashback with urgency pills
│   ├── EarnSheet.tsx                Bottom sheet: enter merchant code → show OTP
│   ├── MerchantProcessSheet.tsx     Bottom sheet: 4-digit PIN entry + purchase amount
│   ├── TemplateEditorSheet.tsx      Bottom sheet: edit message templates per trigger
│   └── ProfileSheet.tsx             Bottom sheet: customer profile + stats
├── lib/
│   ├── prisma.ts                    Singleton PrismaClient with PrismaPg adapter
│   ├── web-auth.ts                  Unified auth (Telegram initData OR JWT cookie), role guards
│   ├── telegram-auth.ts             HMAC-SHA256 initData verification
│   ├── admin-auth.ts                ADMIN_TELEGRAM_IDS helper
│   ├── settings.ts                  DB-backed platform settings with env var fallback
│   ├── api-response.ts              ok(data) / err(message, status) helpers
│   └── templates.ts                 {{variable}} substitution, formatKs, formatDate
├── prisma/
│   ├── schema.prisma                Full data model
│   ├── prisma.config.ts             DATABASE_URL for Prisma 7
│   ├── seed.ts                      Seed merchants, customers, cashbacks, admin user
│   └── migrations/                  Hand-written SQL migrations (Docker unavailable locally)
├── docker-compose.prod.yml          Traefik-based production compose
├── docker-compose.yml               Local dev (PostgreSQL only)
├── Dockerfile                       4-stage: deps → builder → prod-deps → runner
└── .github/workflows/deploy.yml     CI/CD: main → UAT, v* tag → Production
```
