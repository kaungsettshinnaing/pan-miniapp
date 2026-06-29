import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { resolveMerchantMessage } from "@/lib/messages";

const OFFSET_MS = 6.5 * 60 * 60 * 1000;

// GET /api/notifications/winback
// Auth: x-api-secret header (n8n hourly cron)
// Returns: array of { customerTelegramID, trigger, customerMessage } for customers
// whose most recent purchase at a merchant was exactly N days ago (N =
// firstRecallCampaignDays or secondRecallCampaignDays), and the current GMT+6.5
// hour matches the merchant's winbackSendTime. NotificationLog prevents duplicate sends.
export async function GET(request: Request) {
  try {
    const apiSecret = request.headers.get("x-api-secret");
    if (!apiSecret || apiSecret !== process.env.API_SECRET) {
      return err("Unauthorized", 401);
    }

    const nowUTC = new Date();
    const localNow = new Date(nowUTC.getTime() + OFFSET_MS);
    const currentHour = localNow.getUTCHours();

    const localMidnightMs = Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate()
    );
    const todayUTCStart = new Date(localMidnightMs - OFFSET_MS);
    const todayUTCEnd = new Date(todayUTCStart.getTime() + 86400000);

    const merchants = await prisma.merchant.findMany({
      where: { active: true },
      select: {
        merchantURL: true,
        merchantName: true,
        firstRecallCampaignDays: true,
        secondRecallCampaignDays: true,
        winbackSendTime: true,
      },
    });

    const notifications: object[] = [];

    for (const merchant of merchants) {
      const [sendHour] = merchant.winbackSendTime.split(":").map(Number);
      if (sendHour !== currentHour) continue;

      for (const { days, trigger } of [
        { days: merchant.firstRecallCampaignDays, trigger: "FIRST_RECALL_CAMPAIGN" as const },
        { days: merchant.secondRecallCampaignDays, trigger: "SECOND_RECALL_CAMPAIGN" as const },
      ]) {
        // Window: customers whose LAST purchase at this merchant was exactly `days` days ago.
        // "Last purchase" means no newer purchase exists for the same customer+merchant.
        const windowStart = new Date(localMidnightMs - OFFSET_MS - days * 86400000);
        const windowEnd = new Date(windowStart.getTime() + 86400000);

        const qualified = await prisma.$queryRaw<Array<{ customerTelegramID: string }>>`
          SELECT DISTINCT p."customerTelegramID"
          FROM "Purchase" p
          WHERE p."merchantURL" = ${merchant.merchantURL}
            AND p."createdAt" >= ${windowStart}
            AND p."createdAt" < ${windowEnd}
            AND NOT EXISTS (
              SELECT 1 FROM "Purchase" p2
              WHERE p2."customerTelegramID" = p."customerTelegramID"
                AND p2."merchantURL" = ${merchant.merchantURL}
                AND p2."createdAt" >= ${windowEnd}
            )
        `;

        for (const { customerTelegramID } of qualified) {
          // Dedup: skip if already sent this trigger to this customer today
          const alreadySent = await prisma.notificationLog.findFirst({
            where: {
              customerTelegramID,
              merchantURL: merchant.merchantURL,
              trigger,
              sentAt: { gte: todayUTCStart, lt: todayUTCEnd },
            },
          });
          if (alreadySent) continue;

          const customer = await prisma.customer.findUnique({
            where: { customerTelegramID },
            select: { firstName: true, lastName: true },
          });
          const customerName =
            [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Customer";

          const customerMessage = await resolveMerchantMessage(
            merchant.merchantURL,
            trigger,
            {
              merchantName: merchant.merchantName,
              customerName,
              reminderDays: String(days),
            }
          );

          await prisma.notificationLog.create({
            data: { customerTelegramID, merchantURL: merchant.merchantURL, trigger },
          });

          notifications.push({ customerTelegramID, trigger, customerMessage });
        }
      }
    }

    return ok(notifications);
  } catch (e) {
    console.error("[notifications/winback]", e);
    return err("Internal error", 500);
  }
}
