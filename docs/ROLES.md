# PAN Platform — Roles, Auth & Access Reference

---

## Role Matrix

| Role | Who | Access channels | Portal |
|------|-----|-----------------|--------|
| **Customer** | End users | Telegram mini app only | `/` (home) |
| **Merchant cashier** | Outlet staff | Telegram bot text flow only | n8n bot |
| **Merchant owner/manager** | Outlet owner | Web login + Telegram mini app | `/` (merchant tab) |
| **Channel Partner** | Reseller/onboarder | Web login only | `/cp` |
| **Admin** | Platform operator | Web login only | `/admin` |

---

## Auth Methods

### 1. Telegram initData (customers + cashiers)
Every request from the mini app sends `x-telegram-init-data` header.
Verified via HMAC-SHA256: `key = HMAC("WebAppData", botToken)`.
Valid for 1 hour from initData timestamp.
Implementation: `lib/telegram-auth.ts` → `parseTelegramUser(request, botToken)`.

### 2. Web login — JWT cookie (owners, CPs, admins)
POST `/api/auth/login` with `{ username, password }`.
Server bcrypt-verifies, signs JWT with `jose` (`HS256`, 7-day expiry).
JWT stored as `pan_session` httpOnly cookie (Secure in production, SameSite=Lax).
JWT payload: `{ sub: userId, role, username, merchantURL, redemptionGroupID, profitSharePct }`.

### Unified auth flow (`lib/web-auth.ts` → `getAuth(request)`)
```
1. Check x-telegram-init-data header
   → non-empty: verify HMAC → return { source: "telegram", telegramID, firstName }
   → empty/invalid: fall through

2. Check pan_session cookie
   → valid JWT: return { source: "web", id, role, username, merchantURL, redemptionGroupID, profitSharePct }

3. Return null → unauthenticated
```

---

## Role Guards

All guards are in `lib/web-auth.ts`. Use these in API route handlers:

```typescript
// Admin only (Telegram ID in ADMIN_TELEGRAM_IDS env, or web ADMIN role)
const auth = await requireAdmin(request);

// Channel Partner only (web CHANNEL_PARTNER role)
const { auth, cpId } = await requireChannelPartner(request);

// Merchant access — returns full set of accessible merchant URLs
const { auth, merchantURL, merchantURLs } = await requireMerchantAccess(request);
// merchantURL = primary URL for single-outlet operations
// merchantURLs = all URLs (>1 for group owners)

// Backwards-compat single-URL wrapper
const { auth, merchantURL } = await requireMerchantURL(request);
```

**Error convention:** Guards throw `new Error("Unauthorized")` (401) or `new Error("Forbidden")` (403). Route handlers catch and map:
```typescript
const msg = e instanceof Error ? e.message : "Error";
return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
```

---

## Merchant Access — Group vs Single

When a WebUser has `redemptionGroupID` set (group owner):
- `requireMerchantAccess` queries all active merchants in the group
- Returns all their URLs in `merchantURLs`
- For single-outlet operations (template editing etc.), caller can pass `?merchantURL=X` to target a specific outlet, otherwise uses first in group

When a WebUser has `merchantURL` set (single outlet):
- Standard single-outlet access

Telegram users: lookup by `merchantTelegramID` → find their merchant → check `redemptionGroupID` → expand to group if present.

---

## Web Login Flow

```
User visits /login
  → POST /api/auth/login { username, password }
  → Server: findUnique(username), bcrypt.compare
  → Sign JWT, set pan_session cookie
  → Return { role, merchantURL, redemptionGroupID, username }
  → Client redirects:
      ADMIN          → /admin
      CHANNEL_PARTNER → /cp
      MERCHANT       → /   (merchant tab shows automatically)
```

---

## How to Add a New Protected Route

1. Import the appropriate guard from `lib/web-auth.ts`
2. Call it at the top of your handler
3. Map errors to HTTP status

```typescript
import { requireAdmin } from "@/lib/web-auth";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    // ... your logic
    return ok(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
```

---

## How to Add a New WebUser Role

1. Add enum value to `WebUserRole` in `prisma/schema.prisma`
2. Write migration SQL: `ALTER TYPE "WebUserRole" ADD VALUE 'NEW_ROLE';`
3. Add guard function in `lib/web-auth.ts`
4. Add redirect case in `app/login/page.tsx`
5. Add role option to admin Users tab create form (`app/admin/page.tsx`)
6. Add role check to `app/api/admin/web-users/route.ts` POST validation

---

## API Route Access Summary

| Route | Customer | Merchant (TG) | Merchant (web) | CP | Admin |
|-------|----------|---------------|----------------|----|-------|
| `GET /api/balance` | ✓ | — | — | — | — |
| `POST /api/earn` | ✓ | — | — | — | — |
| `POST /api/redeem` | — | ✓ | ✓ | — | — |
| `GET /api/merchant/me` | ✓ (returns isMerchant) | ✓ | ✓ | — | — |
| `GET/PUT /api/merchant/templates` | — | ✓ | ✓ | — | — |
| `GET /api/cp/merchants` | — | — | — | ✓ | — |
| `POST/PATCH /api/cp/merchants` | — | — | — | ✓ | — |
| `GET /api/cp/activity` | — | — | — | ✓ | — |
| `GET /api/cp/earnings` | — | — | — | ✓ | — |
| `GET/POST /api/admin/settings` | — | — | — | — | ✓ |
| `GET/PATCH /api/admin/merchants` | — | — | — | — | ✓ |
| `GET/POST/PATCH/DELETE /api/admin/web-users` | — | — | — | — | ✓ |
| `GET /api/admin/groups` | — | — | — | — | ✓ |

---

## Admin Panel — User Management

Admin creates web logins at `/admin` → Users tab → Create Login.

| Role | Fields |
|------|--------|
| ADMIN | username, password |
| MERCHANT (single outlet) | username, password, merchantURL picker |
| MERCHANT (group owner) | username, password, redemptionGroupID picker |
| CHANNEL_PARTNER | username, password, profitSharePct (%) |

After creation, CP can be assigned merchants either:
- CP onboards merchants themselves via `/cp` portal
- Admin assigns existing merchant via Merchants tab → channelPartnerID field

---

## Session Management

- Sessions expire after 7 days (no sliding window — re-login required)
- No server-side session store — JWT is stateless
- Logout: `POST /api/auth/logout` deletes the cookie
- Password change takes effect on next login (no active session invalidation — acceptable for this scale)
- Profit share % change: user must re-login to get updated JWT payload
