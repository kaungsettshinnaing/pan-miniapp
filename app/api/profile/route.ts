import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const telegramID = String(user.id);

    const [customer, totalBalance, merchantCount, redemptionCount] = await Promise.all([
      prisma.customer.findUnique({ where: { customerTelegramID: telegramID } }),
      prisma.cashback.aggregate({
        where: { customerTelegramID: telegramID, redeemed: false, expiryDate: { gte: new Date() } },
        _sum: { cashbackAmt: true },
      }),
      prisma.cashback.findMany({
        where: { customerTelegramID: telegramID, redeemed: false, expiryDate: { gte: new Date() } },
        distinct: ["merchantURL"],
        select: { merchantURL: true },
      }),
      prisma.purchase.count({
        where: { customerTelegramID: telegramID, rebateDeducted: { gt: 0 } },
      }),
    ]);

    return ok({
      telegramID,
      firstName: customer?.firstName ?? user.first_name,
      lastName: customer?.lastName ?? user.last_name,
      username: customer?.username ?? user.username,
      phoneNumber: customer?.phoneNumber,
      birthday: customer?.birthday?.toISOString().split("T")[0] ?? null,
      totalBalance: totalBalance._sum.cashbackAmt ?? 0,
      activeMerchants: merchantCount.length,
      timesRedeemed: redemptionCount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    console.error("[profile GET]", e);
    return err("Internal error", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const telegramID = String(user.id);
    const { firstName, lastName, phoneNumber, birthday } = (await request.json()) as {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      birthday?: string | null;
    };

    await prisma.customer.upsert({
      where: { customerTelegramID: telegramID },
      update: {
        ...(firstName !== undefined && { firstName: firstName || null }),
        ...(lastName !== undefined && { lastName: lastName || null }),
        ...(phoneNumber !== undefined && { phoneNumber: phoneNumber || null }),
        ...(birthday !== undefined && { birthday: birthday ? new Date(birthday) : null }),
      },
      create: {
        customerTelegramID: telegramID,
        firstName: firstName ?? user.first_name,
        lastName: lastName ?? user.last_name ?? null,
        username: user.username ?? null,
        ...(phoneNumber && { phoneNumber }),
        ...(birthday && { birthday: new Date(birthday) }),
      },
    });

    return ok({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    console.error("[profile PATCH]", e);
    return err("Internal error", 500);
  }
}
