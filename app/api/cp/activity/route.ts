import { requireChannelPartner } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { cpId } = await requireChannelPartner(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

    const merchantURLs = await prisma.merchant
      .findMany({ where: { channelPartnerID: cpId }, select: { merchantURL: true } })
      .then((ms) => ms.map((m) => m.merchantURL));

    if (merchantURLs.length === 0) return ok([]);

    const purchases = await prisma.purchase.findMany({
      where: { merchantURL: { in: merchantURLs } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        merchantURL: true,
        customerTelegramID: true,
        amount: true,
        rebateDeducted: true,
        commissionEarned: true,
        createdAt: true,
        merchant: { select: { merchantName: true } },
        customer: { select: { firstName: true, username: true } },
      },
    });

    return ok(purchases);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
