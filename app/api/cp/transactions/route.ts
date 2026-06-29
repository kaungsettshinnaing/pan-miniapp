import { requireChannelPartner } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

// GET /api/cp/transactions?date=YYYY-MM-DD  (defaults to today)
export async function GET(request: Request) {
  try {
    const { cpId } = await requireChannelPartner(request);
    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");

    // Interpret the date in Myanmar time (UTC+6:30) so day boundaries match the user's clock
    const dateStr = dateParam ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Rangoon" });
    const startOfDay = new Date(`${dateStr}T00:00:00+06:30`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999+06:30`);

    const merchants = await prisma.merchant.findMany({
      where: { channelPartnerID: cpId },
      select: { merchantURL: true, merchantName: true, outletName: true },
      orderBy: { merchantName: "asc" },
    });

    if (merchants.length === 0) return ok([]);

    const merchantURLs = merchants.map((m) => m.merchantURL);

    const [purchases, cashbacks] = await Promise.all([
      prisma.purchase.groupBy({
        by: ["merchantURL"],
        where: { merchantURL: { in: merchantURLs }, createdAt: { gte: startOfDay, lte: endOfDay } },
        _count: { id: true },
      }),
      prisma.cashback.groupBy({
        by: ["merchantURL"],
        where: { merchantURL: { in: merchantURLs }, createdAt: { gte: startOfDay, lte: endOfDay } },
        _count: { id: true },
      }),
    ]);

    const purchaseMap = new Map(purchases.map((p) => [p.merchantURL, p._count.id]));
    const cashbackMap = new Map(cashbacks.map((c) => [c.merchantURL, c._count.id]));

    return ok(
      merchants.map((m) => ({
        merchantURL: m.merchantURL,
        merchantName: m.merchantName,
        outletName: m.outletName,
        redemptions: purchaseMap.get(m.merchantURL) ?? 0,
        issued: cashbackMap.get(m.merchantURL) ?? 0,
      }))
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return err(msg, 401);
    if (msg === "Forbidden") return err(msg, 403);
    return err("Internal error", 500);
  }
}
