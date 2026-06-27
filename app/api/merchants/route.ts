import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

// GET /api/merchants?url=QQHotpotBBQ — look up a merchant by URL
export async function GET(request: Request) {
  try {
    parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);

    const { searchParams } = new URL(request.url);
    const merchantURL = searchParams.get("url");
    if (!merchantURL) return err("url param required");

    const merchant = await prisma.merchant.findUnique({
      where: { merchantURL },
      select: {
        merchantURL: true,
        merchantName: true,
        outletName: true,
        active: true,
        earnType: true,
        earnValue: true,
        rebateValidityDays: true,
        redemptionGroupID: true,
      },
    });
    if (!merchant) return err("Merchant not found", 404);

    return ok(merchant);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    return err("Internal error", 500);
  }
}
