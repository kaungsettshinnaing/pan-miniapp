import { getAuth } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = await getAuth(request);
    if (!auth) return ok({ isMerchant: false, merchant: null });

    let merchant = null;

    if (auth.source === "telegram") {
      merchant = await prisma.merchant.findFirst({
        where: { merchantTelegramID: auth.telegramID, active: true },
        select: { merchantURL: true, merchantName: true, outletName: true, earnType: true, earnValue: true, commissionType: true, commissionValue: true },
      });
    } else if (auth.role === "MERCHANT" && auth.merchantURL) {
      merchant = await prisma.merchant.findFirst({
        where: { merchantURL: auth.merchantURL, active: true },
        select: { merchantURL: true, merchantName: true, outletName: true, earnType: true, earnValue: true, commissionType: true, commissionValue: true },
      });
    }

    return ok({ isMerchant: !!merchant, merchant: merchant ?? null });
  } catch (e) {
    return err(e instanceof Error ? e.message : "Error", 500);
  }
}
