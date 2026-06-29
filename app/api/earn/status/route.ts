import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { resolveMerchantMessage } from "@/lib/messages";

// GET /api/earn/status?sessionId=xxx
// Polled by the mini-app every 3 s while the customer is showing their PIN.
// Returns the current state of the OTP session so the UI can transition to
// success, failed, or cancelled screens without requiring a manual refresh.
export async function GET(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const telegramID = String(user.id);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return err("sessionId required", 400);

    const session = await prisma.otpSession.findFirst({
      where: { id: sessionId, customerTelegramID: telegramID },
      include: { merchant: { select: { merchantName: true } } },
    });

    if (!session) return err("Session not found", 404);

    if (session.cancelled) {
      return ok({ status: "cancelled" });
    }

    if (session.used) {
      // resultMessage is stored by /api/redeem after a successful redemption
      const customerMessage = session.resultMessage as {
        trigger: string; text: string; imageURL: string | null;
      } | null;
      return ok({ status: "redeemed", customerMessage, merchantName: session.merchant.merchantName });
    }

    if (session.expiresAt < new Date()) {
      const customerMessage = await resolveMerchantMessage(
        session.merchantURL,
        "REDEMPTION_FAILURE",
        { merchantName: session.merchant.merchantName }
      );
      return ok({ status: "expired", customerMessage });
    }

    return ok({ status: "pending" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    return err("Internal error", 500);
  }
}
