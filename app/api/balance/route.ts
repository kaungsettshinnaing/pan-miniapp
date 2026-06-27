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

    // Ensure customer record exists
    await prisma.customer.upsert({
      where: { customerTelegramID: telegramID },
      create: {
        customerTelegramID: telegramID,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      update: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });

    const now = new Date();

    // Get all active (non-redeemed, non-expired) cashbacks
    const cashbacks = await prisma.cashback.findMany({
      where: {
        customerTelegramID: telegramID,
        redeemed: false,
        expiryDate: { gte: now },
      },
      include: {
        merchant: {
          select: {
            merchantName: true,
            outletName: true,
            merchantURL: true,
            active: true,
          },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    const totalBalance = cashbacks.reduce((sum: number, c) => sum + c.cashbackAmt, 0);
    const expiringCount = cashbacks.filter((c) => {
      const days =
        (c.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return days <= 7;
    }).length;

    return ok({
      totalBalance,
      expiringCount,
      cashbacks: cashbacks.map((c) => ({
        id: c.id,
        merchantURL: c.merchantURL,
        merchantName: c.merchant.merchantName,
        outletName: c.merchant.outletName,
        merchantActive: c.merchant.active,
        cashbackAmt: c.cashbackAmt,
        expiryDate: c.expiryDate.toISOString(),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    console.error("[balance]", e);
    return err("Internal error", 500);
  }
}
