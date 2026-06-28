# PAN Platform — Data Schema Reference

---

## Models Overview

```
RedemptionGroup ──< Merchant ──< Cashback
                              ──< Purchase
                              ──< OtpSession
                              ──< MessageTemplate
                              ──< MonthlyBilling
                              ──< WebUser (MerchantLogin relation)
                    WebUser   ──< Merchant (ChannelPartnerMerchants relation)
Customer ──< Cashback
         ──< Purchase
         ──< OtpSession
PlatformSetting (key/value, standalone)
WebUser (standalone auth table)
```

---

## RedemptionGroup

Allows cross-redemption across multiple merchants/outlets (e.g. a restaurant chain).

```prisma
id          String    @id @default(cuid())
groupName   String
description String?
merchants   Merchant[]
webUsers    WebUser[]   // group-owner web logins
createdAt   DateTime  @default(now())
```

**Business rule:** If a merchant belongs to a group, customers can earn at any member merchant and redeem at any other member merchant. OTP earn queries all merchants in the group; redeem verifies processor is same group or same merchant.

---

## Merchant

```prisma
merchantURL              String           @id   // slug used in QR codes and API
merchantName             String
outletName               String?
merchantTelegramID       String                 // Telegram ID of the cashier/owner
active                   Boolean          @default(true)
botToken                 String?               // custom bot; null = use PAN shared bot
earnType                 EarnType              // PERCENTAGE | FIXED
earnValue                Float                 // % of NET purchase or fixed Ks
commissionType           CommissionType        // PERCENTAGE | FLAT
commissionBasis          CommissionBasis   @default(RETURN_TRANSACTION)
commissionValue          Float                 // PAN's cut per redemption
subscriptionFee          Float                 // monthly flat fee in Ks
rebateValidityDays       Int       @default(14)
firstReminderDays        Int       @default(7)  // days before expiry for 1st reminder
secondReminderDays       Int       @default(3)
firstRecallCampaignDays  Int       @default(21) // days after last visit for win-back
secondRecallCampaignDays Int       @default(30)
redemptionGroupID        String?               // FK → RedemptionGroup
channelPartnerID         String?               // FK → WebUser (the CP who manages this merchant)
createdAt / updatedAt
```

**Enums:**
- `EarnType`: `PERCENTAGE` | `FIXED`
- `CommissionType`: `PERCENTAGE` | `FLAT`
- `CommissionBasis`: `RETURN_TRANSACTION` | `INITIAL_TRANSACTION`
  - Only relevant when `commissionType = PERCENTAGE`
  - `RETURN_TRANSACTION`: commission % on current visit's gross purchase
  - `INITIAL_TRANSACTION`: commission % on the purchase amount that generated the cashback being redeemed (stored in `Cashback.originalPurchaseAmount`)

---

## Customer

```prisma
customerTelegramID  String   @id    // Telegram user ID as string
username            String?
firstName           String?
lastName            String?
phoneNumber         String?
birthday            DateTime?
```

Customers are upserted on first `/api/balance` call — no pre-registration needed.

---

## Cashback

The loyalty ledger. One row per cashback issued.

```prisma
id                     String    @id @default(cuid())
merchantURL            String    // FK → Merchant
customerTelegramID     String    // FK → Customer
cashbackAmt            Float     // Ks amount
originalPurchaseAmount Float     @default(0)  // gross purchase that generated this cashback
expiryDate             DateTime
redeemed               Boolean   @default(false)
redemptionDate         DateTime?
createdAt              DateTime  @default(now())

@@index([merchantURL, customerTelegramID, redeemed, expiryDate])
```

**Business rules:**
- Earn and redeem always happen in the same visit — one cashback per customer per merchant/group at a time; previous cashback must be redeemed before a new one is issued
- No partial redemption — all unredeemed cashbacks for that merchant (or group) are consumed at once
- **NET purchase** = `max(0, grossPurchase − totalRedeemed)`. If net = 0, **no new cashback is issued**
- New cashback = `net × earnRate%` (PERCENTAGE) or `earnValue` (FIXED, only if net > 0)
- `originalPurchaseAmount` is set to the current gross purchase when the cashback is created. Next visit, if `commissionBasis = INITIAL_TRANSACTION`, this value is used for commission calculation
- Expiry is `now() + rebateValidityDays`

**Cashback calculation example:**
- Gross purchase Ks 20,000 · existing cashback Ks 2,000 → net Ks 18,000
- earnType=PERCENTAGE, earnValue=5 → new cashback = 18,000 × 5% = **Ks 900**
- commissionType=PERCENTAGE, commissionBasis=RETURN_TRANSACTION, commissionValue=1 → commission = 20,000 × 1% = **Ks 200**
- same but INITIAL_TRANSACTION (originalPurchaseAmount=40,000) → commission = 40,000 × 1% = **Ks 400**

---

## Purchase

Transaction log. Created on every redemption event.

```prisma
id                 String   @id @default(cuid())
merchantURL        String
customerTelegramID String
amount             Float    // purchase amount in Ks
rebateDeducted     Float    // cashback redeemed (Ks) — PAN liability cleared
commissionEarned   Float    // PAN revenue for this transaction
note               String?
createdAt          DateTime @default(now())

@@index([merchantURL, customerTelegramID, createdAt])
```

**Channel Partner earnings** = `SUM(commissionEarned) WHERE merchantURL IN (CP's merchants) × profitSharePct / 100`

---

## OtpSession

Short-lived (5 min TTL). Created when customer taps "Get My PIN".

```prisma
id                 String   @id @default(cuid())
customerTelegramID String
merchantURL        String   // the merchant the customer is earning at
otpCode            String   // 4-digit code
totalCashback      Float    // total redeemable balance at time of OTP generation
expiresAt          DateTime
used               Boolean  @default(false)

@@index([otpCode, merchantURL, used, expiresAt])
```

**Business rule:** OTP is marked `used = true` inside the same `$transaction` as the redemption — prevents double-redemption even if the request is retried.

---

## MessageTemplate

Per-merchant, per-platform, per-trigger custom messages.

```prisma
id          String         @id @default(cuid())
merchantURL String
platform    Platform       // TELEGRAM (only value currently)
trigger     MessageTrigger
messageText String?        // supports {{variables}}
imageURL    String?
updatedAt   DateTime       @updatedAt

@@unique([merchantURL, platform, trigger])
```

**Triggers (`MessageTrigger` enum):**
| Trigger | When |
|---------|------|
| `CASHBACK_ISSUED` | New cashback earned (no redemption this visit) |
| `CASHBACK_ISSUED_WITH_REDEMPTION` | Redeemed + new cashback issued |
| `REDEMPTION_FAILURE` | OTP invalid / expired |
| `EXPIRY_FIRST_REMINDER` | N days before expiry (firstReminderDays) |
| `EXPIRY_SECOND_REMINDER` | N days before expiry (secondReminderDays) |
| `FIRST_RECALL_CAMPAIGN` | N days since last visit (firstRecallCampaignDays) |
| `SECOND_RECALL_CAMPAIGN` | N days since last visit (secondRecallCampaignDays) |

**Template variables:** `{{cashbackAmt}}` `{{expiryDate}}` `{{merchantName}}` `{{purchaseAmount}}` `{{customerName}}` `{{reminderDays}}`

If a merchant has no custom template for a trigger, n8n uses its own default message.

---

## MonthlyBilling

End-of-month commission + subscription summary per merchant.

```prisma
id              String   @id @default(cuid())
merchantURL     String
billingMonth    String   // "YYYY-MM"
totalCommission Float
subscriptionFee Float
totalDue        Float    // totalCommission + subscriptionFee
paid            Boolean  @default(false)
createdAt       DateTime @default(now())

@@unique([merchantURL, billingMonth])
```

Not yet auto-generated — Phase 5 (billing engine) will populate this monthly.

---

## WebUser

Web login for Admin, Merchant owner/manager, and Channel Partner.

```prisma
id                String           @id @default(cuid())
username          String           @unique
passwordHash      String           // bcrypt cost 12
role              WebUserRole
merchantURL       String?          // MERCHANT — single outlet access
redemptionGroupID String?          // MERCHANT — group owner (all outlets in group)
profitSharePct    Float?           // CHANNEL_PARTNER — % of commissionEarned, set by Admin
managedMerchants  Merchant[]       // CHANNEL_PARTNER — merchants they onboarded
createdAt / updatedAt
```

**Role logic:**
- `MERCHANT` with `merchantURL`: single outlet login → `/`
- `MERCHANT` with `redemptionGroupID`: sees all merchants in group → `/`
- `CHANNEL_PARTNER`: sees only their managed merchants → `/cp`
- `ADMIN`: full access → `/admin`

---

## PlatformSetting

Key/value store for admin-configurable settings. No redeploy needed.

```prisma
key       String   @id
value     String
updatedAt DateTime @updatedAt
```

**Managed keys:**
| Key | Description |
|-----|-------------|
| `N8N_WEBHOOK_URL` | Base URL for n8n webhooks |
| `DEFAULT_BOT_TOKEN` | PAN's shared Telegram bot token |
| `CASHBACK_APP_NAME` | Display name of the platform |

`lib/settings.ts` `getSetting(key)` checks DB first, then falls back to `process.env[key]`.

---

## Migrations

Stored in `prisma/migrations/` as hand-written SQL (Docker was unavailable locally when schema was designed).

| Migration | Contents |
|-----------|----------|
| `20260628000000_init` | All base tables, enums, indexes, FKs |
| `20260628000001_platform_settings` | `PlatformSetting` table |
| `20260628000002_web_users` | `WebUser` table + `WebUserRole` enum |
| `20260628000003_channel_partner` | `CHANNEL_PARTNER` enum value, `WebUser.redemptionGroupID`, `WebUser.profitSharePct`, `Merchant.channelPartnerID` |
| `20260628000004_commission_basis` | `CommissionBasis` enum, `Merchant.commissionBasis`, `Cashback.originalPurchaseAmount` |

Apply on VPS: `npx prisma migrate deploy` (run inside the app container).
