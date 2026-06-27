import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const telegramID = String(user.id);

    const merchant = await prisma.merchant.findFirst({
      where: { merchantTelegramID: telegramID, active: true },
      select: {
        merchantURL: true,
        merchantName: true,
        outletName: true,
        earnType: true,
        earnValue: true,
        commissionType: true,
        commissionValue: true,
      },
    });

    return ok({ isMerchant: !!merchant, merchant: merchant ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    return err("Internal error", 500);
  }
}
