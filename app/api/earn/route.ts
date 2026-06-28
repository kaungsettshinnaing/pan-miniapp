import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { ok, err } from "@/lib/api-response";

// POST /api/earn — customer enters merchant code, gets OTP
export async function POST(request: Request) {
  try {
    const { user } = parseTelegramUser(
      request,
      process.env.TELEGRAM_BOT_TOKEN!
    );
    const telegramID = String(user.id);

    const body = await request.json();
    const merchantURL: string = body.merchantURL?.trim();
    if (!merchantURL) return err("merchantURL required");

    // Verify merchant exists and is active
    const merchant = await prisma.merchant.findUnique({
      where: { merchantURL },
    });
    if (!merchant) return err("Merchant not found", 404);
    if (!merchant.active) return err("Merchant is currently inactive");

    // Get active cashback balance for this customer at this merchant (or group)
    let merchantURLFilter: string | { in: string[] } = merchantURL;

    if (merchant.redemptionGroupID) {
      // Cross-redemption: sum cashback across all merchants in the same group
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
      where: {
        customerTelegramID: telegramID,
        merchantURL,
        used: false,
      },
      data: { used: true },
    });

    const session = await prisma.otpSession.create({
      data: {
        customerTelegramID: telegramID,
        merchantURL,
        otpCode,
        totalCashback,
        expiresAt,
      },
    });

    // Notify merchant via n8n webhook (fire-and-forget)
    notifyMerchant({
      merchantTelegramID: merchant.merchantTelegramID,
      merchantURL,
      customerName: [user.first_name, user.last_name].filter(Boolean).join(" "),
      totalCashback,
      otpCode,
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
  totalCashback: number;
  otpCode: string;
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
