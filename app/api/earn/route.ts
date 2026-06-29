import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { ok, err } from "@/lib/api-response";
import { resolveMerchantMessage, type ResolvedMessage } from "@/lib/messages";
import { formatKs } from "@/lib/templates";

// POST /api/earn — customer enters merchant code, gets OTP
// Auth: Telegram WebApp initData (mini-app) OR x-api-secret header (n8n bot flow)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const merchantURL: string = body.merchantURL?.trim();
    if (!merchantURL) return err("merchantURL required");

    // Determine customer identity from auth path
    let telegramID: string;
    let customerName: string;

    const apiSecret = request.headers.get("x-api-secret");
    if (apiSecret && process.env.API_SECRET && apiSecret === process.env.API_SECRET) {
      // Bot flow: customer identity supplied in body by n8n
      if (!body.customerTelegramID) return err("customerTelegramID required for API secret auth", 400);
      telegramID = String(body.customerTelegramID);
      customerName = String(body.customerName || "Customer");
    } else {
      // Mini-app flow: customer identity from Telegram WebApp initData
      const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
      telegramID = String(user.id);
      customerName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    }

    // Verify merchant exists and is active
    const merchant = await prisma.merchant.findUnique({
      where: { merchantURL },
    });
    if (!merchant) return err("Merchant not found", 404);
    if (!merchant.active) return err("Merchant is currently inactive");

    // Get active cashback balance for this customer at this merchant (or group)
    let merchantURLFilter: string | { in: string[] } = merchantURL;

    if (merchant.redemptionGroupID) {
      const groupMerchants = await prisma.merchant.findMany({
        where: { redemptionGroupID: merchant.redemptionGroupID },
        select: { merchantURL: true },
      });
      merchantURLFilter = {
        in: groupMerchants.map((m: { merchantURL: string }) => m.merchantURL),
      };
    }

    const cashbacks = await prisma.cashback.findMany({
      where: {
        customerTelegramID: telegramID,
        merchantURL: merchantURLFilter,
        redeemed: false,
        expiryDate: { gte: new Date() },
      },
      orderBy: { expiryDate: "asc" },
    });
    const totalCashback = cashbacks.reduce((sum: number, c) => sum + c.cashbackAmt, 0);

    // Generate 4-digit OTP
    const otpCode = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

    // Invalidate any previous unused OTP for same customer+merchant
    await prisma.otpSession.updateMany({
      where: { customerTelegramID: telegramID, merchantURL, used: false },
      data: { used: true },
    });

    const session = await prisma.otpSession.create({
      data: { customerTelegramID: telegramID, merchantURL, otpCode, totalCashback, expiresAt },
    });

    // Backend resolves the customer's branded message (image + text + PIN) so it's
    // identical whether the customer started in the mini-app or by texting the bot.
    const customerMessage = await resolveMerchantMessage(merchantURL, "CASHBACK_ISSUED", {
      pin: otpCode,
      cashbackAmt: formatKs(totalCashback),
      merchantName: merchant.merchantName,
      customerName,
    });

    // Notify merchant via n8n webhook (fire-and-forget)
    notifyMerchant({
      merchantTelegramID: merchant.merchantTelegramID,
      merchantURL,
      customerName,
      customerTelegramID: telegramID,
      totalCashback,
      customerMessage,
      appBaseURL: process.env.NEXT_PUBLIC_APP_URL,
      sessionId: session.id,
    }).catch((e) => console.error("[earn] notify merchant failed:", e));

    return ok({
      sessionId: session.id,
      otpCode,
      merchantName: merchant.merchantName,
      totalCashback,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    console.error("[earn]", e);
    return err("Internal error", 500);
  }
}

async function notifyMerchant(payload: {
  merchantTelegramID: string;
  merchantURL: string;
  customerName: string;
  customerTelegramID: string;
  totalCashback: number;
  customerMessage: ResolvedMessage;
  appBaseURL: string | undefined;
  sessionId: string;
}) {
  const n8nUrl = await getSetting("N8N_WEBHOOK_URL");
  if (!n8nUrl) return;
  await fetch(`${n8nUrl}/pan-merchant-notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
