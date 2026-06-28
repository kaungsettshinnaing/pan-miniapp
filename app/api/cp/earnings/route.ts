import { requireChannelPartner } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { cpId, auth } = await requireChannelPartner(request);
    const profitSharePct = (auth as { profitSharePct?: number | null }).profitSharePct ?? 0;

    const merchantURLs = await prisma.merchant
      .findMany({ where: { channelPartnerID: cpId }, select: { merchantURL: true } })
      .then((ms) => ms.map((m) => m.merchantURL));

    if (merchantURLs.length === 0) {
      return ok({ months: [], totalCommission: 0, myShare: 0, profitSharePct });
    }

    // Group purchases by YYYY-MM
    const purchases = await prisma.purchase.findMany({
      where: { merchantURL: { in: merchantURLs } },
      select: { commissionEarned: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const monthMap = new Map<string, number>();
    for (const p of purchases) {
      const month = p.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
      monthMap.set(month, (monthMap.get(month) ?? 0) + p.commissionEarned);
    }

    const months = Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .map(([month, commission]) => ({
        month,
        commission,
        myShare: commission * (profitSharePct / 100),
      }));

    const totalCommission = months.reduce((s, m) => s + m.commission, 0);
    const myShare = totalCommission * (profitSharePct / 100);

    return ok({ months, totalCommission, myShare, profitSharePct });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
