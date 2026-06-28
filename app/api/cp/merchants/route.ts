import { requireChannelPartner } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

const MERCHANT_SELECT = {
  merchantURL: true,
  merchantName: true,
  outletName: true,
  merchantTelegramID: true,
  active: true,
  earnType: true,
  earnValue: true,
  commissionType: true,
  commissionBasis: true,
  commissionValue: true,
  subscriptionFee: true,
  rebateValidityDays: true,
  redemptionGroupID: true,
  redemptionGroup: { select: { groupName: true } },
  _count: { select: { purchases: true } },
} as const;

export async function GET(request: Request) {
  try {
    const { cpId } = await requireChannelPartner(request);
    const merchants = await prisma.merchant.findMany({
      where: { channelPartnerID: cpId },
      orderBy: { merchantName: "asc" },
      select: MERCHANT_SELECT,
    });
    return ok(merchants);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const { cpId } = await requireChannelPartner(request);
    const body = (await request.json()) as Record<string, unknown>;

    if (!body.merchantURL || !body.merchantName || !body.earnValue) {
      return err("merchantURL, merchantName, and earnValue are required", 400);
    }

    const merchant = await prisma.merchant.create({
      data: {
        merchantURL: body.merchantURL as string,
        merchantName: body.merchantName as string,
        outletName: (body.outletName as string) || null,
        merchantTelegramID: (body.merchantTelegramID as string) || "",
        earnType: (body.earnType as never) || "PERCENTAGE",
        earnValue: Number(body.earnValue),
        commissionType: (body.commissionType as never) || "PERCENTAGE",
        commissionBasis: (body.commissionBasis as never) || "RETURN_TRANSACTION",
        commissionValue: Number(body.commissionValue ?? 0),
        subscriptionFee: Number(body.subscriptionFee ?? 0),
        rebateValidityDays: Number(body.rebateValidityDays ?? 14),
        channelPartnerID: cpId,
      },
      select: MERCHANT_SELECT,
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
    const { cpId } = await requireChannelPartner(request);
    const body = (await request.json()) as {
      merchantURL?: string;
      merchantName?: string;
      outletName?: string | null;
      merchantTelegramID?: string;
      active?: boolean;
      earnType?: string;
      earnValue?: number;
      commissionType?: string;
      commissionBasis?: string;
      commissionValue?: number;
      subscriptionFee?: number;
      rebateValidityDays?: number;
    };
    if (!body.merchantURL) return err("merchantURL is required", 400);

    // Verify ownership
    const existing = await prisma.merchant.findFirst({
      where: { merchantURL: body.merchantURL, channelPartnerID: cpId },
    });
    if (!existing) return err("Merchant not found or not yours", 404);

    const {
      merchantURL,
      merchantName, outletName, merchantTelegramID, active,
      earnType, earnValue, commissionType, commissionBasis, commissionValue,
      subscriptionFee, rebateValidityDays,
    } = body;
    const merchant = await prisma.merchant.update({
      where: { merchantURL },
      data: {
        ...(merchantName !== undefined && { merchantName }),
        ...(outletName !== undefined && { outletName }),
        ...(merchantTelegramID !== undefined && { merchantTelegramID }),
        ...(active !== undefined && { active }),
        ...(earnType !== undefined && { earnType: earnType as never }),
        ...(earnValue !== undefined && { earnValue }),
        ...(commissionType !== undefined && { commissionType: commissionType as never }),
        ...(commissionBasis !== undefined && { commissionBasis: commissionBasis as never }),
        ...(commissionValue !== undefined && { commissionValue }),
        ...(subscriptionFee !== undefined && { subscriptionFee }),
        ...(rebateValidityDays !== undefined && { rebateValidityDays }),
      },
      select: MERCHANT_SELECT,
    });
    return ok(merchant);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
