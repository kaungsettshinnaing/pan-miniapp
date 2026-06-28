import { parseAdminUser } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    parseAdminUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const merchants = await prisma.merchant.findMany({
      orderBy: { merchantName: "asc" },
      include: { redemptionGroup: { select: { groupName: true } } },
    });
    return ok(merchants);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg.includes("Forbidden") ? 403 : msg.includes("initData") ? 401 : 500);
  }
}

export async function PATCH(request: Request) {
  try {
    parseAdminUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const body = (await request.json()) as {
      merchantURL?: string;
      botToken?: string | null;
      active?: boolean;
      earnType?: string;
      earnValue?: number;
      commissionType?: string;
      commissionValue?: number;
      subscriptionFee?: number;
      rebateValidityDays?: number;
      redemptionGroupID?: string | null;
    };
    if (!body.merchantURL) return err("merchantURL is required", 400);
    const { merchantURL, ...data } = body;
    const merchant = await prisma.merchant.update({
      where: { merchantURL },
      data: data as Parameters<typeof prisma.merchant.update>[0]["data"],
    });
    return ok(merchant);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg.includes("Forbidden") ? 403 : msg.includes("initData") ? 401 : 500);
  }
}
