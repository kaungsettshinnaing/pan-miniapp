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

export async function signSession(payload: {
  sub: string;
  role: "ADMIN" | "MERCHANT";
  merchantURL: string | null;
  username: string;
}) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY}s`)
    .sign(secret());
}

async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as {
      sub: string;
      role: "ADMIN" | "MERCHANT";
      merchantURL: string | null;
      username: string;
    };
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

// ── Unified auth result ───────────────────────────────────────────────────────
export type AuthUser =
  | { source: "telegram"; telegramID: string; firstName?: string }
  | { source: "web"; id: string; role: "ADMIN" | "MERCHANT"; merchantURL: string | null; username: string };

export async function getAuth(request: Request): Promise<AuthUser | null> {
  // 1. Try Telegram initData
  const initData = request.headers.get("x-telegram-init-data");
  if (initData) {
    try {
      const parsed = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
      return { source: "telegram", telegramID: String(parsed.user.id), firstName: parsed.user.first_name };
    } catch {
      // empty or invalid initData — fall through to cookie
    }
  }

  // 2. Try cookie JWT
  const token = parseCookie(request.headers.get("cookie"), COOKIE);
  if (token) {
    const payload = await verifySession(token);
    if (payload) {
      return { source: "web", id: payload.sub, role: payload.role, merchantURL: payload.merchantURL, username: payload.username };
    }
  }

  return null;
}

// ── Role helpers ──────────────────────────────────────────────────────────────
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const auth = await getAuth(request);
  if (!auth) throw new Error("Unauthorized");
  if (auth.source === "telegram" && !getAdminIds().includes(auth.telegramID)) throw new Error("Forbidden");
  if (auth.source === "web" && auth.role !== "ADMIN") throw new Error("Forbidden");
  return auth;
}

export async function requireMerchantURL(request: Request): Promise<{ auth: AuthUser; merchantURL: string }> {
  const auth = await getAuth(request);
  if (!auth) throw new Error("Unauthorized");

  if (auth.source === "telegram") {
    const m = await prisma.merchant.findFirst({
      where: { merchantTelegramID: auth.telegramID, active: true },
      select: { merchantURL: true },
    });
    if (!m) throw new Error("Forbidden");
    return { auth, merchantURL: m.merchantURL };
  }

  if (auth.role !== "MERCHANT" || !auth.merchantURL) throw new Error("Forbidden");
  return { auth, merchantURL: auth.merchantURL };
}
