import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { ok, err } from "@/lib/api-response";
import { resolveMerchantMessage } from "@/lib/messages";

// POST /api/earn/cancel — customer cancels their active OTP session.
// Marks the session cancelled and fires pan-redemption-cancelled to n8n
// so both the customer and merchant receive a Telegram notification.
export async function POST(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const telegramID = String(user.id);

    const body = await request.json();
    const { sessionId } = body as { sessionId?: string };
    if (!sessionId) return err("sessionId required", 400);

    const session = await prisma.otpSession.findFirst({
      where: {
        id: sessionId,
        customerTelegramID: telegramID,
        used: false,
        cancelled: false,
      },
      include: {
        merchant: { select: { merchantName: true, merchantTelegramID: true } },
        customer: { select: { firstName: true } },
      },
    });

    if (!session) return err("Session not found or already completed", 404);

    const now = new Date();
    await prisma.otpSession.update({
      where: { id: sessionId },
      data: { cancelled: true, cancelledAt: now },
    });

    const customerName = session.customer.firstName ?? "Customer";
    const customerMessage = await resolveMerchantMessage(
      session.merchantURL,
      "REDEMPTION_CANCELLED",
      { merchantName: session.merchant.merchantName, customerName }
    );

    const n8nUrl = await getSetting("N8N_WEBHOOK_URL");
    if (n8nUrl) {
      fetch(`${n8nUrl}/pan-redemption-cancelled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerTelegramID: telegramID,
          merchantTelegramID: session.merchant.merchantTelegramID,
          merchantName: session.merchant.merchantName,
          customerName,
          totalCashback: session.totalCashback,
          customerMessage,
        }),
      }).catch(() => {});
    }

    return ok({});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    return err("Internal error", 500);
  }
}
