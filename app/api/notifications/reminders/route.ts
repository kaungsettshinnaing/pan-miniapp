import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { resolveMerchantMessage } from "@/lib/messages";
import { formatKs, formatDate } from "@/lib/templates";

// GMT+6.5 offset in milliseconds (UTC+6:30 = Myanmar Standard Time)
const OFFSET_MS = 6.5 * 60 * 60 * 1000;

// GET /api/notifications/reminders
// Auth: x-api-secret header (n8n hourly cron)
// Returns: array of { customerTelegramID, trigger, customerMessage } for all customers
// whose cashback expires in exactly N days today, where N matches the merchant's
// firstReminderDays or secondReminderDays, and the current GMT+6.5 hour matches
// the merchant's reminderSendTime. NotificationLog prevents duplicate sends.
export async function GET(request: Request) {
  try {
    const apiSecret = request.headers.get("x-api-secret");
    if (!apiSecret || apiSecret !== process.env.API_SECRET) {
      return err("Unauthorized", 401);
    }

    const nowUTC = new Date();
    const localNow = new Date(nowUTC.getTime() + OFFSET_MS);
    const currentHour = localNow.getUTCHours();

    // Start/end of today in UTC, derived from local midnight
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
        firstReminderDays: true,
        secondReminderDays: true,
        reminderSendTime: true,
      },
    });

    const notifications: object[] = [];

    for (const merchant of merchants) {
      const [sendHour] = merchant.reminderSendTime.split(":").map(Number);
      if (sendHour !== currentHour) continue;

      for (const { days, trigger } of [
        { days: merchant.firstReminderDays, trigger: "EXPIRY_FIRST_REMINDER" as const },
        { days: merchant.secondReminderDays, trigger: "EXPIRY_SECOND_REMINDER" as const },
      ]) {
        // Date window for cashbacks expiring exactly `days` days from today (local time)
        const windowStart = new Date(localMidnightMs - OFFSET_MS + days * 86400000);
        const windowEnd = new Date(windowStart.getTime() + 86400000);

        const cashbacks = await prisma.cashback.findMany({
          where: {
            merchantURL: merchant.merchantURL,
            redeemed: false,
            expiryDate: { gte: windowStart, lt: windowEnd },
            // Exclude customers already sent this trigger today
            customer: {
              notificationLogs: {
                none: {
                  merchantURL: merchant.merchantURL,
                  trigger,
                  sentAt: { gte: todayUTCStart, lt: todayUTCEnd },
                },
              },
            },
          },
          include: {
            customer: {
              select: { customerTelegramID: true, firstName: true, lastName: true },
            },
          },
        });

        for (const cashback of cashbacks) {
          const { customerTelegramID, firstName, lastName } = cashback.customer;
          const customerName = [firstName, lastName].filter(Boolean).join(" ") || "Customer";

          const customerMessage = await resolveMerchantMessage(
            merchant.merchantURL,
            trigger,
            {
              cashbackAmt: formatKs(cashback.cashbackAmt),
              expiryDate: formatDate(cashback.expiryDate),
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
    console.error("[notifications/reminders]", e);
    return err("Internal error", 500);
  }
}
