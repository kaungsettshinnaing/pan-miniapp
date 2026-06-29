import { requireAdmin } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const merchants = await prisma.merchant.findMany({
      orderBy: { merchantName: "asc" },
      include: {
        redemptionGroup: { select: { groupName: true } },
        channelPartner: { select: { username: true } },
      },
    });
    return ok(merchants);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request) {
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
      reminderSendTime?: string;
      winbackSendTime?: string;
      redemptionGroupID?: string | null;
      channelPartnerID?: string | null;
    };
    if (!body.merchantURL || !body.merchantName) {
      return err("merchantURL and merchantName are required", 400);
    }
    if (!body.earnType || !body.commissionType) {
      return err("earnType and commissionType are required", 400);
    }
    const merchant = await prisma.merchant.create({
      data: {
        merchantURL: body.merchantURL.trim(),
        merchantName: body.merchantName,
        outletName: body.outletName || null,
        merchantTelegramID: body.merchantTelegramID ?? "",
        active: body.active ?? true,
        botToken: body.botToken || null,
        earnType: body.earnType as never,
        earnValue: Number(body.earnValue ?? 0),
        commissionType: body.commissionType as never,
        commissionBasis: (body.commissionBasis as never) || "RETURN_TRANSACTION",
        commissionValue: Number(body.commissionValue ?? 0),
        subscriptionFee: Number(body.subscriptionFee ?? 0),
        rebateValidityDays: Number(body.rebateValidityDays ?? 14),
        ...(body.firstReminderDays !== undefined && { firstReminderDays: Number(body.firstReminderDays) }),
        ...(body.secondReminderDays !== undefined && { secondReminderDays: Number(body.secondReminderDays) }),
        ...(body.firstRecallCampaignDays !== undefined && { firstRecallCampaignDays: Number(body.firstRecallCampaignDays) }),
        ...(body.secondRecallCampaignDays !== undefined && { secondRecallCampaignDays: Number(body.secondRecallCampaignDays) }),
        ...(body.reminderSendTime && { reminderSendTime: body.reminderSendTime }),
        ...(body.winbackSendTime && { winbackSendTime: body.winbackSendTime }),
        redemptionGroupID: body.redemptionGroupID || null,
        channelPartnerID: body.channelPartnerID || null,
      },
    });
    return ok(merchant);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Unique constraint")) return err("Merchant URL already taken", 409);
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
      reminderSendTime?: string;
      winbackSendTime?: string;
      redemptionGroupID?: string | null;
      channelPartnerID?: string | null;
    };
    if (!body.merchantURL) return err("merchantURL is required", 400);
    const {
      merchantURL,
      merchantName, outletName, merchantTelegramID, active, botToken,
      earnType, earnValue, commissionType, commissionBasis, commissionValue,
      subscriptionFee, rebateValidityDays,
      firstReminderDays, secondReminderDays, firstRecallCampaignDays, secondRecallCampaignDays,
      reminderSendTime, winbackSendTime,
      redemptionGroupID, channelPartnerID,
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
        ...(reminderSendTime !== undefined && { reminderSendTime }),
        ...(winbackSendTime !== undefined && { winbackSendTime }),
        ...(redemptionGroupID !== undefined && { redemptionGroupID }),
        ...(channelPartnerID !== undefined && { channelPartnerID }),
      },
    });
    return ok(merchant);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
