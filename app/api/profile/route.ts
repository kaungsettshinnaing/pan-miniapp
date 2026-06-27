import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { user } = parseTelegramUser(
      request,
      process.env.TELEGRAM_BOT_TOKEN!
    );
    const telegramID = String(user.id);

    const [customer, totalBalance, merchantCount, redemptionCount] =
      await Promise.all([
        prisma.customer.findUnique({ where: { customerTelegramID: telegramID } }),
        prisma.cashback.aggregate({
          where: {
            customerTelegramID: telegramID,
            redeemed: false,
            expiryDate: { gte: new Date() },
          },
          _sum: { cashbackAmt: true },
        }),
        prisma.cashback.findMany({
          where: {
            customerTelegramID: telegramID,
            redeemed: false,
            expiryDate: { gte: new Date() },
          },
          distinct: ["merchantURL"],
          select: { merchantURL: true },
        }),
        prisma.purchase.count({
          where: {
            customerTelegramID: telegramID,
            rebateDeducted: { gt: 0 },
          },
        }),
      ]);

    return ok({
      telegramID,
      firstName: customer?.firstName ?? user.first_name,
      lastName: customer?.lastName ?? user.last_name,
      username: customer?.username ?? user.username,
      phoneNumber: customer?.phoneNumber,
      totalBalance: totalBalance._sum.cashbackAmt ?? 0,
      activeMerchants: merchantCount.length,
      timesRedeemed: redemptionCount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    console.error("[profile]", e);
    return err("Internal error", 500);
  }
}
