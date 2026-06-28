import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { parseTelegramUser } from "./telegram-auth";
import { prisma } from "./prisma";
import { getAdminIds } from "./admin-auth";

const COOKIE = "pan_session";
const EXPIRY = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return new TextEncoder().encode(s);
}

// ── JWT ───────────────────────────────────────────────────────────────────────
export type SessionPayload = {
  sub: string;
  role: "ADMIN" | "MERCHANT" | "CHANNEL_PARTNER";
  username: string;
  merchantURL: string | null;
  redemptionGroupID: string | null;
  profitSharePct: number | null;
};

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY}s`)
    .sign(secret());
}

async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: EXPIRY,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

// ── Auth result ───────────────────────────────────────────────────────────────
export type AuthUser =
  | { source: "telegram"; telegramID: string; firstName?: string }
  | {
      source: "web";
      id: string;
      role: "ADMIN" | "MERCHANT" | "CHANNEL_PARTNER";
      username: string;
      merchantURL: string | null;
      redemptionGroupID: string | null;
      profitSharePct: number | null;
    };

export async function getAuth(request: Request): Promise<AuthUser | null> {
  // 1. Try Telegram initData
  const initData = request.headers.get("x-telegram-init-data");
  if (initData) {
    try {
      const parsed = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
      return { source: "telegram", telegramID: String(parsed.user.id), firstName: parsed.user.first_name };
    } catch {
      // empty / invalid — fall through to cookie
    }
  }

  // 2. Try httpOnly cookie
  const token = parseCookie(request.headers.get("cookie"), COOKIE);
  if (token) {
    const p = await verifySession(token);
    if (p) {
      return {
        source: "web",
        id: p.sub,
        role: p.role,
        username: p.username,
        merchantURL: p.merchantURL,
        redemptionGroupID: p.redemptionGroupID,
        profitSharePct: p.profitSharePct,
      };
    }
  }

  return null;
}

// ── Role guards ───────────────────────────────────────────────────────────────
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const auth = await getAuth(request);
  if (!auth) throw new Error("Unauthorized");
  if (auth.source === "telegram" && !getAdminIds().includes(auth.telegramID)) throw new Error("Forbidden");
  if (auth.source === "web" && auth.role !== "ADMIN") throw new Error("Forbidden");
  return auth;
}

export async function requireChannelPartner(request: Request): Promise<{ auth: AuthUser; cpId: string }> {
  const auth = await getAuth(request);
  if (!auth) throw new Error("Unauthorized");
  if (auth.source !== "web" || auth.role !== "CHANNEL_PARTNER") throw new Error("Forbidden");
  return { auth, cpId: auth.id };
}

// Returns every merchantURL the authenticated merchant user can access.
// Telegram → their outlet only.
// Web MERCHANT + merchantURL → single outlet.
// Web MERCHANT + redemptionGroupID → all outlets in the group.
export async function requireMerchantAccess(request: Request): Promise<{
  auth: AuthUser;
  merchantURLs: string[];
  merchantURL: string;   // primary for single-outlet operations
}> {
  const auth = await getAuth(request);
  if (!auth) throw new Error("Unauthorized");

  if (auth.source === "telegram") {
    const m = await prisma.merchant.findFirst({
      where: { merchantTelegramID: auth.telegramID, active: true },
      select: { merchantURL: true, redemptionGroupID: true },
    });
    if (!m) throw new Error("Forbidden");

    if (m.redemptionGroupID) {
      const group = await prisma.merchant.findMany({
        where: { redemptionGroupID: m.redemptionGroupID, active: true },
        select: { merchantURL: true },
      });
      const urls = group.map((g) => g.merchantURL);
      return { auth, merchantURLs: urls, merchantURL: m.merchantURL };
    }
    return { auth, merchantURLs: [m.merchantURL], merchantURL: m.merchantURL };
  }

  if (auth.role !== "MERCHANT") throw new Error("Forbidden");

  if (auth.redemptionGroupID) {
    const group = await prisma.merchant.findMany({
      where: { redemptionGroupID: auth.redemptionGroupID, active: true },
      select: { merchantURL: true },
    });
    if (group.length === 0) throw new Error("Forbidden");
    const urls = group.map((g) => g.merchantURL);
    const target = new URL(request.url).searchParams.get("merchantURL");
    const primary = target && urls.includes(target) ? target : urls[0];
    return { auth, merchantURLs: urls, merchantURL: primary };
  }

  if (!auth.merchantURL) throw new Error("Forbidden");
  return { auth, merchantURLs: [auth.merchantURL], merchantURL: auth.merchantURL };
}

// Backwards-compatible wrapper — single-URL callers (templates, redeem, etc.)
export async function requireMerchantURL(request: Request) {
  const { auth, merchantURL } = await requireMerchantAccess(request);
  return { auth, merchantURL };
}
