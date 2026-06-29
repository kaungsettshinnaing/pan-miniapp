import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

// GET /api/earn/active — returns the customer's current pending OTP session (if any).
// Used by the mini-app on load to auto-show a session that was started via the Telegram bot.
export async function GET(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const telegramID = String(user.id);

    const session = await prisma.otpSession.findFirst({
      where: {
        customerTelegramID: telegramID,
        used: false,
        cancelled: false,
        expiresAt: { gte: new Date() },
      },
      include: {
        merchant: { select: { merchantName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!session) return ok({ session: null });

    return ok({
      session: {
        sessionId: session.id,
        otpCode: session.otpCode,
        merchantName: session.merchant.merchantName,
        merchantURL: session.merchantURL,
        totalCashback: session.totalCashback,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    return err("Internal error", 500);
  }
}
