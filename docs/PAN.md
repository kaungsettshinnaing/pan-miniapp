# PAN Platform — Architecture & Developer Reference

Pyan Ann Ngwe (ပြန်အမ်းငွေ) is a multi-merchant cashback loyalty platform for Myanmar.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16.2.9, App Router, React 19 |
| Database | PostgreSQL via Docker |
| ORM | Prisma 7.8.0 with `@prisma/adapter-pg` (adapter-based, no `url` in schema.prisma) |
| Auth | Telegram initData HMAC-SHA256 **or** httpOnly JWT cookie (jose) **or** `x-api-secret` header |
| Passwords | bcryptjs (cost 12) |
| Styling | Tailwind CSS v4 with `@theme` directive |
| Hosting | Hostinger VPS, Docker + Traefik (SSL via Let's Encrypt) |
| CI/CD | GitHub Actions → SSH deploy |
| Notifications | n8n webhooks (fire-and-forget after DB commit) |

### Prisma 7 quirks
- No `url = env("DATABASE_URL")` in `schema.prisma` datasource — URL lives in `prisma.config.ts`
- Client init: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })`
- Generated client at `app/generated/prisma/` — import from `@/app/generated/prisma/client`

---

## Dual-Channel Resilience

Myanmar internet blocking can take down VPS-hosted sites. Both channels read/write the **same PostgreSQL** — no sync needed.

```
Channel A: Telegram bot text flow
  └── Customer texts merchant code to bot (e.g. "Test1")
  └── n8n receives message, calls /api/earn via API secret
  └── Backend generates OTP, fires pan-merchant-notify webhook
  └── n8n combined workflow: sends customer OTP message + cashier form

Channel B: Telegram Mini App + Web portals
  └── Customer opens mini-app, taps Earn Cashback, enters merchant code
  └── Mini-app calls /api/earn with Telegram initData auth
  └── Backend generates OTP, fires pan-merchant-notify webhook
  └── n8n combined workflow: sends customer OTP message + cashier form

Both channels converge at pan-merchant-notify → same n8n combined workflow
Both write to the same PostgreSQL on VPS

Resilience:
  VPS down → Channel A bot flow can't call /api/earn → both channels impacted
  n8n down → customers can still use Channel B (mini-app) for earn; cashier uses in-app merchant tab for redemption
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

**Manual deploy (inside env dir on VPS):**
```bash
git pull origin main
docker compose -f docker-compose.prod.yml down --remove-orphans
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

> Use `down --remove-orphans` before `up` to avoid container name conflicts from previous runs.

---

## Environment Variables (`.env.prod` on VPS)

```env
POSTGRES_USER=pan_user
POSTGRES_PASSWORD=<strong>
POSTGRES_DB=pan_db
DATABASE_URL=                        # built by docker-compose from above three

TELEGRAM_BOT_TOKEN=                  # bot token from BotFather (shared PAN bot)
NEXT_PUBLIC_APP_URL=https://uat.cashbackapp.cloud  # used in n8n callback URL (appBaseURL)

JWT_SECRET=<openssl rand -hex 32>    # required for web login cookies
API_SECRET=<openssl rand -hex 32>    # shared secret for n8n → app API calls

ADMIN_TELEGRAM_IDS=                  # optional — comma-separated TG IDs for Telegram admin access
ADMIN_USERNAME=admin                 # seed creates this admin user on first run
ADMIN_PASSWORD=<strong>

DOMAIN=uat.cashbackapp.cloud
APP_ENV=pan-uat                      # pan-prod for production
```

**Key rules:**
- `N8N_WEBHOOK_URL` is set via the Admin panel UI (stored in `PlatformSetting` table) — no redeploy needed
- `API_SECRET` must match the value set in every n8n node that calls `/api/earn` or `/api/redeem` via the `x-api-secret` header
- `NEXT_PUBLIC_APP_URL` is sent in the `pan-merchant-notify` payload as `appBaseURL` so n8n can call back to the correct environment

---

## Traefik Routing

Hostinger VPS has Traefik pre-installed on port 80/443. Do **not** run nginx.

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

## Authentication Patterns

Three auth patterns are used across routes:

### 1. Telegram WebApp initData (mini-app customers)
- Header: `x-telegram-init-data: <initData string from Telegram.WebApp.initData>`
- Verified via HMAC-SHA256 against `TELEGRAM_BOT_TOKEN`
- Used by: `/api/earn`, `/api/balance`, `/api/profile`, `/api/merchant/me`
- Lib: `parseTelegramUser(request, TELEGRAM_BOT_TOKEN)` in `lib/telegram-auth.ts`

### 2. JWT cookie (web portal users)
- HttpOnly cookie `pan_token` set on login via `/api/auth/login`
- Signed/verified with `JWT_SECRET` using jose
- Used by: `/admin/*`, `/cp/*`, `/api/merchant/*`
- Lib: `requireAdmin(request)`, `requireChannelPartner(request)`, `requireMerchantAccess(request)` in `lib/web-auth.ts`

### 3. API secret header (n8n → app)
- Header: `x-api-secret: <API_SECRET env var>`
- Used by: `/api/earn` (bot earn flow), `/api/redeem` (n8n cashier form)
- Bypasses Telegram/JWT auth entirely; caller must supply `merchantURL` and/or `customerTelegramID` in the body
- Same `API_SECRET` value used across all n8n nodes that call the app

### `requireMerchantAccess` — unified merchant auth
Returns `{ merchantURL, merchantURLs }` where `merchantURLs` is a list including all merchants in the same redemption group (for cross-group operations). Accepts EITHER Telegram initData OR JWT cookie — whichever is present. Throws "Unauthorized" or "Forbidden" if neither is valid.

---

## API Endpoints

### `POST /api/earn`
**Purpose:** Customer submits a merchant code → OTP session created, customer gets PIN message, cashier gets notification.

**Auth:**
- Mini-app: `x-telegram-init-data` header
- Bot/n8n: `x-api-secret` header + `customerTelegramID` + `customerName` in body

**Request body:**
```json
{
  "merchantURL": "Test1",
  "customerTelegramID": "8517287235",  // required only for API secret auth
  "customerName": "Simon"              // required only for API secret auth
}
```

**Business logic:**
1. Identify customer (from initData or body)
2. Verify merchant exists and `active = true`
3. Sum all unredeemed, non-expired cashbacks for this customer at this merchant (or across the group if merchant has `redemptionGroupID`)
4. Invalidate any existing unused OTP for same customer+merchant
5. Create new `OtpSession` (4-digit code, 5 min TTL)
6. Resolve `CASHBACK_ISSUED` message template via `resolveMerchantMessage` (substitutes `{{pin}}`, `{{cashbackAmt}}`, `{{merchantName}}`, `{{customerName}}`)
7. Fire `pan-merchant-notify` webhook to n8n (fire-and-forget) with full payload including resolved `customerMessage` and `appBaseURL`

**Success response:**
```json
{
  "ok": true,
  "data": {
    "sessionId": "clx...",
    "otpCode": "1234",
    "merchantName": "BerryBooTest",
    "totalCashback": 5000,
    "expiresAt": "2026-06-29T06:30:00.000Z"
  }
}
```

**pan-merchant-notify webhook payload:**
```json
{
  "merchantTelegramID": "123456789",
  "merchantURL": "Test1",
  "customerName": "Simon",
  "customerTelegramID": "8517287235",
  "totalCashback": 5000,
  "appBaseURL": "https://uat.cashbackapp.cloud",
  "sessionId": "clx...",
  "customerMessage": {
    "trigger": "CASHBACK_ISSUED",
    "text": "🎁 BerryBooTest\n\nYour cashback: Ks 5,000\nYour PIN: 1234",
    "imageURL": null
  }
}
```

---

### `POST /api/redeem`
**Purpose:** Cashier submits OTP + purchase amount → redemption processed, customer notified.

**Auth:**
- In-app merchant tab: `x-telegram-init-data` OR JWT cookie via `requireMerchantAccess`
- n8n cashier form: `x-api-secret` header + `merchantURL` in body

**Request body:**
```json
{
  "otpCode": "1234",          // string or number (coerced to string server-side)
  "purchaseAmount": 100000,
  "merchantURL": "Test1"      // required only for API secret auth
}
```

**Business logic — on invalid OTP:**
1. No DB changes
2. Resolve `REDEMPTION_FAILURE` template
3. Return `{ ok: false, error: "Invalid or expired PIN", customerMessage: { trigger, text, imageURL } }`
4. n8n combined workflow forwards `customerMessage` to the customer (it still holds their chatId from the earn step)

**Business logic — on valid OTP:**

Calculates within a single atomic `$transaction`:

| Step | Table | Operation |
|------|-------|-----------|
| 1 | `Cashback` | `updateMany` → set `redeemed = true`, `redemptionDate = now` for all active cashbacks of this customer at this merchant/group |
| 2 | `Purchase` | `create` → records `amount` (gross), `rebateDeducted` (totalCashback from OTP), `commissionEarned` |
| 3 | `Cashback` | `create` new row only if `newCashbackAmt > 0`: `cashbackAmt`, `originalPurchaseAmount = purchaseAmount`, `expiryDate = now + rebateValidityDays` |
| 4 | `MonthlyBilling` | `upsert` for `merchantURL + "YYYY-MM"`: `totalCommission += commissionEarned`, `totalDue += commissionEarned` |
| 5 | `OtpSession` | `update` → `used = true` (prevents double-redemption on retry) |

**Cashback calculation:**
```
netPurchase    = max(0, grossPurchase − totalCashback)
newCashbackAmt = netPurchase === 0 ? 0
               : earnType === PERCENTAGE ? netPurchase × (earnValue / 100)
               : earnValue   // FIXED — always issued if net > 0
```
> If `netPurchase = 0`, the existing cashback is still consumed (redeemed) and a purchase record is created, but **no new cashback is issued**.

**Commission calculation:**
```
commissionEarned = commissionType === FLAT
  ? commissionValue
  : commissionBasis === RETURN_TRANSACTION
    ? grossPurchase × (commissionValue / 100)
    : originalPurchaseAmount × (commissionValue / 100)
```
`originalPurchaseAmount` = the gross purchase that *generated* the cashback being redeemed (stored in `Cashback.originalPurchaseAmount` at earn time). Used when the merchant wants to charge commission based on the purchase that generated the rebate, not the current visit.

**After transaction:**
1. Resolves `CASHBACK_ISSUED_WITH_REDEMPTION` template (substitutes `{{cashbackAmt}}`, `{{purchaseAmount}}`, `{{expiryDate}}`, `{{merchantName}}`, `{{customerName}}`)
2. If **NOT** an n8n call: fires `pan-cashback-issued` webhook (in-app merchant tab redemption path — n8n sends customer success message)
3. If **IS** an n8n call: `pan-cashback-issued` is NOT fired — the combined n8n workflow sends the customer success message directly from the `customerMessage` in the response

**Success response:**
```json
{
  "ok": true,
  "data": {
    "redeemedAmount": 5000,
    "netPurchase": 95000,
    "newCashbackAmt": 9500,
    "purchaseAmount": 100000,
    "merchantName": "BerryBooTest",
    "customerName": "Simon",
    "expiryDate": "2026-07-13T01:39:05.336Z",
    "expiryDateFormatted": "13 Jul 2026",
    "customerMessage": {
      "trigger": "CASHBACK_ISSUED_WITH_REDEMPTION",
      "text": "✅ Thanks for visiting BerryBooTest!\n\nPurchase: Ks 100,000\nNew cashback: Ks 9,500\nValid until 13 Jul 2026.",
      "imageURL": null
    }
  }
}
```

---

### `GET /api/balance`
Customer's total unredeemed cashback with per-merchant breakdown. Auth: Telegram initData.

Returns cashbacks sorted by expiry (earliest first). Used by the mini-app home screen.
Auto-refreshed when:
- The EarnSheet closes (after showing OTP)
- The document becomes visible again (`visibilitychange` event) — handles customers who switch apps while showing the OTP to the cashier

---

### `GET /api/merchant/templates` / `PUT /api/merchant/templates`
Merchant's message templates. Auth: Telegram initData or JWT cookie. Merchants can customize the text and image for each trigger via the TemplateEditorSheet component.

---

### `GET/POST /api/admin/merchants` / `PATCH /api/admin/merchants`
Admin management of all merchants. GET includes `channelPartner: { username }`. PATCH accepts all merchant fields including `channelPartnerID`. POST creates new merchant (409 on duplicate `merchantURL`).

---

## Message System

**Backend is the single source of truth.** `lib/messages.ts` → `resolveMerchantMessage(merchantURL, trigger, vars)` → `{ trigger, text, imageURL }`

- Looks up `MessageTemplate` from DB (merchantURL + TELEGRAM + trigger)
- Falls back to hardcoded `DEFAULTS` if no custom template exists
- Substitutes `{{variables}}` via `lib/templates.ts → renderTemplate()`
- Returns `trigger` (the enum name) echoed back so n8n can log which template fired

n8n never does template logic — it only forwards the resolved `{ trigger, text, imageURL }` object.

### Triggers

| Trigger | When fired | Available variables |
|---------|-----------|-------------------|
| `CASHBACK_ISSUED` | Customer earns (OTP generated, no redemption this visit) | `{{pin}}` `{{cashbackAmt}}` `{{merchantName}}` `{{customerName}}` |
| `CASHBACK_ISSUED_WITH_REDEMPTION` | Cashier redeems + new cashback issued | `{{cashbackAmt}}` `{{purchaseAmount}}` `{{expiryDate}}` `{{merchantName}}` `{{customerName}}` |
| `REDEMPTION_FAILURE` | OTP invalid or expired | `{{merchantName}}` |
| `EXPIRY_FIRST_REMINDER` | N days before expiry (firstReminderDays) | `{{cashbackAmt}}` `{{expiryDate}}` `{{merchantName}}` `{{reminderDays}}` |
| `EXPIRY_SECOND_REMINDER` | N days before expiry (secondReminderDays) | same as above |
| `FIRST_RECALL_CAMPAIGN` | N days since last visit (firstRecallCampaignDays) | `{{merchantName}}` `{{customerName}}` `{{reminderDays}}` |
| `SECOND_RECALL_CAMPAIGN` | N days since last visit (secondRecallCampaignDays) | same as above |

> `{{pin}}` is only substituted during `CASHBACK_ISSUED`. In all other templates it renders literally if accidentally included.

### `formatDate` output
`13 Jul 2026` (en-GB locale: day month year with abbreviated month name, space-separated)

### `formatKs` output
`Ks 5,000` (Ks prefix, comma thousands separator)

---

## n8n Integration

n8n runs at `https://n8n-qxa2.cashbackapp.cloud/` on separate hosting for resilience.

### Webhook URL convention
- Active (production) webhook: `https://n8n-qxa2.cashbackapp.cloud/webhook/<path>`
- Test webhook: `https://n8n-qxa2.cashbackapp.cloud/webhook-test/<path>` (only active while workflow is open in editor)

`N8N_WEBHOOK_URL` stored in `PlatformSetting` table should be the **production** base: `https://n8n-qxa2.cashbackapp.cloud/webhook`

### Three n8n workflows

---

#### `n8n-pan-bot-earn.json` — "UAT - PAN - Bot Earn Trigger"

**Webhook type:** Telegram Trigger (listens for bot messages)

**Purpose:** Entry point for Channel A (bot text flow). Customer sends merchant code as a bot message.

**Flow:**
```
Bot Message (Telegram Trigger)
  → Call Earn API (POST /api/earn, x-api-secret)
      body: { merchantURL: message.text, customerTelegramID: from.id, customerName: from.first_name }
  → Earn OK?
      TRUE: [end — backend already fired pan-merchant-notify, combined workflow handles the rest]
      FALSE: Send Error to Customer (text: error message)
```

**Key points:**
- The earn API fires `pan-merchant-notify` automatically on success — the bot trigger doesn't need to do anything else on the happy path
- On error (e.g. merchant not found, merchant inactive): sends `$json.error` back to the customer

---

#### `n8n-pan-cashier-combined.json` — "UAT - PAN - Customer Cashback Issued"

**Webhook path:** `pan-merchant-notify` (POST, responseMode: onReceived)

**Purpose:** Handles the full cashier interaction after earn. Fires for both mini-app earn and bot earn.

**Flow:**
```
Webhook1 (pan-merchant-notify)
  → Earn Has Image?
      TRUE:  Customer - Earn Image (sendPhoto to customerTelegramID, caption = customerMessage.text)
      FALSE: Customer Earn (Text) (sendMessage to customerTelegramID)
  → Notify Cashier1 (sendAndWait customForm to merchantTelegramID)
      Button label: "Redeem"
      Form fields: OTP (number, required), Amount (number, required), Note (textarea)
  → Call Redeem API (POST appBaseURL/api/redeem)
      Headers: x-api-secret
      Body: { otpCode: $json.data.OTP, purchaseAmount: $json.data.Amount, merchantURL: body.merchantURL }
  → Success?1
      TRUE:  Cashier Success → Success Has Image?
                 TRUE:  Customer Success (Photo) (sendPhoto to customerTelegramID)
                 FALSE: Customer Success (Text)  (sendMessage to customerTelegramID)
      FALSE: Cashier Error → Fail Has Image?
                 TRUE:  Customer Fail (Photo) (sendPhoto to customerTelegramID)
                 FALSE: Customer Fail (Text)  (sendMessage to customerTelegramID)
```

**Key points:**
- `appBaseURL` comes from `$('Webhook1').item.json.body.appBaseURL` — set by the backend per environment. Do NOT hardcode UAT URL.
- `Call Redeem API` uses `neverError: true` so 4xx responses are treated as normal data (not workflow errors)
- `Cashier Success` message is the Myanmar-language success message sent to the merchant's cashier
- Customer success message (`customerMessage`) comes from `$('Call Redeem API').item.json.data.customerMessage` — resolved by the backend and included in the success response
- Customer failure message comes from `$('Call Redeem API').item.json.customerMessage` (top-level, on the error response body) — resolved by the backend and included in the 400 error response
- `otpCode` from the form is a **number** (`$json.data.OTP`); the backend coerces it to string — no need to format in n8n
- Telegram credential: `UAT PAN` (id: `vjliuOCYYRY2eaMq`)

---

#### `n8n-pan-cashback-issued.json` — for in-app redemption path

**Webhook path:** `pan-cashback-issued` (POST)

**Purpose:** Sends the customer success message when redemption is done via the **in-app merchant tab** (not the n8n cashier form). The combined workflow does NOT fire for in-app redemptions — this workflow bridges that gap.

**Flow:**
```
Webhook (pan-cashback-issued)
  → Earn Has Image? (checks customerMessage.imageURL)
      TRUE:  sendPhoto to customerTelegramID (caption = customerMessage.text)
      FALSE: sendMessage to customerTelegramID
```

**Key points:**
- Backend fires this ONLY when `isN8nCall = false` (i.e. redeemed via in-app merchant tab, not n8n)
- When n8n calls `/api/redeem` (via API secret), `pan-cashback-issued` is NOT fired — the combined workflow sends the customer message directly from the response

---

### No-double-send guarantee
| Redemption path | Who sends customer success message |
|---|---|
| n8n cashier form | Combined workflow (reads `customerMessage` from redeem response) |
| In-app merchant tab | `pan-cashback-issued` workflow (fired by backend) |

The backend skips `pan-cashback-issued` when `isN8nCall = true` to prevent the combined workflow and the separate webhook from both sending the same message.

---

## Cross-Redemption Groups

If `merchant.redemptionGroupID` is set, the merchant belongs to a group (e.g. a chain of outlets):

**Earn:** `totalCashback` = sum of unredeemed cashbacks for this customer across ALL merchants in the group.

**Redeem:** The OTP is valid at any outlet in the group. `merchantURLs` = all merchant URLs in the group. The processor (cashier) is authorized as long as their outlet is in the group.

**New cashback** is always issued under the specific `merchantURL` where redemption occurred (not group-wide).

---

## Billing Accumulation

`MonthlyBilling` is upserted on every redemption:
- `totalCommission` accumulates across the month
- `subscriptionFee` is set only on the first redemption of the month (create path); it does NOT increment on subsequent redemptions
- `totalDue = totalCommission + subscriptionFee`
- `billingMonth` format: `"YYYY-MM"` (e.g. `"2026-06"`)

Manual billing engine (Phase 5) will generate invoices from this table.

---

## Customer UI — Balance Refresh

The balance (`GET /api/balance`) is re-fetched:
1. **On mount** — initial load
2. **On EarnSheet close** — after the customer has been shown their OTP and closes the sheet, the balance is refreshed to reflect any redemption that happened while they were showing the PIN to the cashier
3. **On `visibilitychange`** — when the customer returns to the mini-app after switching to another app (common when showing PIN), the balance refreshes automatically

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
│   │                                Balance refreshes on mount, EarnSheet close, and visibilitychange
│   ├── admin/page.tsx               Admin portal (Settings, Merchants [+Add], Users tabs)
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
│       ├── earn/route.ts            Customer/bot: POST merchantURL → OTP session
│       │                            Auth: initData (mini-app) OR x-api-secret + customerTelegramID (n8n bot)
│       ├── redeem/route.ts          Merchant: POST otpCode+purchaseAmount → process redemption
│       │                            Auth: initData/JWT (in-app) OR x-api-secret + merchantURL (n8n form)
│       ├── profile/route.ts         Customer: GET stats
│       ├── merchants/route.ts       Public: GET merchant info by URL
│       ├── merchant/
│       │   ├── me/route.ts          GET isMerchant + merchant info (Telegram or cookie)
│       │   └── templates/route.ts   GET/PUT message templates
│       ├── admin/
│       │   ├── settings/route.ts    GET/POST platform settings (N8N URL, bot token, etc.)
│       │   ├── merchants/route.ts   GET all / POST new / PATCH any merchant (incl. channelPartnerID)
│       │   ├── web-users/route.ts   GET/POST/PATCH/DELETE web login users
│       │   ├── groups/route.ts      GET redemption groups (for dropdowns)
│       │   └── templates/route.ts   GET/PUT message templates for any merchant (admin override)
│       └── cp/
│           ├── merchants/route.ts   GET/POST/PATCH CP's merchants
│           ├── activity/route.ts    GET redemptions across CP's merchants
│           └── earnings/route.ts    GET commission × profitSharePct breakdown
├── components/
│   ├── BalanceHero.tsx              Total balance card with merchant/expiry badges
│   ├── MerchantCard.tsx             Per-merchant cashback with urgency pills
│   ├── EarnSheet.tsx                Bottom sheet: enter merchant code → show OTP
│   ├── MerchantProcessSheet.tsx     Bottom sheet: 4-digit PIN entry + purchase amount (in-app cashier)
│   ├── TemplateEditorSheet.tsx      Bottom sheet: edit message templates per trigger
│   │                                Variable chips: {{pin}} {{cashbackAmt}} {{expiryDate}} {{merchantName}}
│   │                                               {{purchaseAmount}} {{customerName}} {{reminderDays}}
│   └── ProfileSheet.tsx             Bottom sheet: customer profile + stats
├── lib/
│   ├── prisma.ts                    Singleton PrismaClient with PrismaPg adapter
│   ├── web-auth.ts                  Unified auth (Telegram initData OR JWT cookie), role guards
│   │                                requireMerchantAccess → { merchantURL, merchantURLs }
│   ├── telegram-auth.ts             HMAC-SHA256 initData verification
│   ├── admin-auth.ts                ADMIN_TELEGRAM_IDS helper
│   ├── settings.ts                  getSetting(key): DB first, then process.env fallback
│   ├── api-response.ts              ok(data) / err(message, status, extra?) helpers
│   │                                err() accepts extra fields merged into response (used for customerMessage on failure)
│   ├── messages.ts                  resolveMerchantMessage(merchantURL, trigger, vars) → { trigger, text, imageURL }
│   │                                DEFAULTS fallback when no custom template exists
│   └── templates.ts                 renderTemplate(), formatKs(), formatDate(), daysUntil()
├── docs/
│   ├── PAN.md                       This file — full architecture and developer reference
│   ├── SCHEMA.md                    Data models, business rules, migration history
│   ├── ROLES.md                     Role matrix, auth flow, route access patterns
│   ├── n8n-pan-bot-earn.json        n8n: bot message → /api/earn (entry point for Channel A)
│   ├── n8n-pan-cashier-combined.json n8n: pan-merchant-notify → cashier form → redeem → messages
│   └── n8n-pan-cashback-issued.json n8n: pan-cashback-issued → customer success message (in-app path)
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

---

## Adding a New n8n Workflow

1. Design the workflow in n8n
2. Export as JSON from n8n → save to `docs/n8n-<name>.json`
3. Update this file's workflow table
4. Update `pan-project.md` memory if the flow is architecturally significant

When importing into n8n:
- Delete the old version of the workflow first
- Import the JSON
- Set any credentials (Telegram bot) and secrets (`x-api-secret` header values)
- Activate the workflow

---

## Common Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `git pull` aborted with "local changes" on clean files | CRLF line endings from Windows editor on Linux VPS | `git reset --hard origin/main` |
| Container name conflict on `docker compose up` | Old container not removed | `docker compose down --remove-orphans` first |
| "Missing x-telegram-init-data header" from earn/redeem API | API_SECRET not in container env, or container not rebuilt | Check `printenv API_SECRET` inside container; rebuild if missing |
| n8n "Invalid or expired PIN" with correct PIN | n8n form field label changed — `OTP` field must be named exactly `OTP` so `$json.data.OTP` resolves correctly | Check sendAndWait form field labels |
| Customer doesn't get success message | `pan-cashback-issued` workflow not active | Toggle workflow active in n8n |
| Cashier gets two success messages | Old `Merchant - Success Message` node still chained after `Cashier Success` | Remove the connection in n8n |
| Customer gets earn message twice | `Customer - Earn Image` chained to `Customer - Earn Text` | Fix: image path goes directly to Notify Cashier |
