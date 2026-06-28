import { requireAdmin } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const merchants = await prisma.merchant.findMany({
      orderBy: { merchantName: "asc" },
      include: { redemptionGroup: { select: { groupName: true } } },
    });
    return ok(merchants);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as {
      merchantURL?: string;
      merchantName?: string;
      outletName?: string | null;
      merchantTelegramID?: string;
      active?: boolean;
      botToken?: string | null;
      earnType?: string;
      earnValue?: number;
      commissionType?: string;
      commissionBasis?: string;
      commissionValue?: number;
      subscriptionFee?: number;
      rebateValidityDays?: number;
      firstReminderDays?: number;
      secondReminderDays?: number;
      firstRecallCampaignDays?: number;
      secondRecallCampaignDays?: number;
      redemptionGroupID?: string | null;
    };
    if (!body.merchantURL) return err("merchantURL is required", 400);
    const {
      merchantURL,
      merchantName, outletName, merchantTelegramID, active, botToken,
      earnType, earnValue, commissionType, commissionBasis, commissionValue,
      subscriptionFee, rebateValidityDays,
      firstReminderDays, secondReminderDays, firstRecallCampaignDays, secondRecallCampaignDays,
      redemptionGroupID,
    } = body;
    const merchant = await prisma.merchant.update({
      where: { merchantURL },
      data: {
        ...(merchantName !== undefined && { merchantName }),
        ...(outletName !== undefined && { outletName }),
        ...(merchantTelegramID !== undefined && { merchantTelegramID }),
        ...(active !== undefined && { active }),
        ...(botToken !== undefined && { botToken }),
        ...(earnType !== undefined && { earnType: earnType as never }),
        ...(earnValue !== undefined && { earnValue }),
        ...(commissionType !== undefined && { commissionType: commissionType as never }),
        ...(commissionBasis !== undefined && { commissionBasis: commissionBasis as never }),
        ...(commissionValue !== undefined && { commissionValue }),
        ...(subscriptionFee !== undefined && { subscriptionFee }),
        ...(rebateValidityDays !== undefined && { rebateValidityDays }),
        ...(firstReminderDays !== undefined && { firstReminderDays }),
        ...(secondReminderDays !== undefined && { secondReminderDays }),
        ...(firstRecallCampaignDays !== undefined && { firstRecallCampaignDays }),
        ...(secondRecallCampaignDays !== undefined && { secondRecallCampaignDays }),
        ...(redemptionGroupID !== undefined && { redemptionGroupID }),
      },
    });
    return ok(merchant);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
