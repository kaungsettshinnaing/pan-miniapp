import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const merchantTelegramID = String(user.id);

    const body = (await request.json()) as { otpCode?: string; purchaseAmount?: number };
    const { otpCode, purchaseAmount } = body;

    if (!otpCode || !purchaseAmount || purchaseAmount <= 0) {
      return err("otpCode and purchaseAmount are required", 400);
    }

    // Verify the caller is an active merchant
    const merchant = await prisma.merchant.findFirst({
      where: { merchantTelegramID, active: true },
    });
    if (!merchant) return err("Not authorized as a merchant", 403);

    // Fetch the OTP session
    const otp = await prisma.otpSession.findFirst({
      where: { otpCode, used: false, expiresAt: { gte: new Date() } },
      include: {
        merchant: { select: { merchantURL: true, redemptionGroupID: true } },
        customer: { select: { customerTelegramID: true, firstName: true, lastName: true } },
      },
    });
    if (!otp) return err("Invalid or expired PIN", 400);

    // Authorize: processing merchant must be the OTP merchant or in the same redemption group
    const isSame = otp.merchantURL === merchant.merchantURL;
    const inGroup =
      !isSame &&
      !!merchant.redemptionGroupID &&
      merchant.redemptionGroupID === otp.merchant.redemptionGroupID;
    if (!isSame && !inGroup) return err("This PIN was not issued for your merchant", 403);

    const { customerTelegramID } = otp;
    const now = new Date();
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Determine which merchantURLs are eligible for redemption
    let groupURLs: string[] | null = null;
    if (otp.merchant.redemptionGroupID) {
      const peers = await prisma.merchant.findMany({
        where: { redemptionGroupID: otp.merchant.redemptionGroupID },
        select: { merchantURL: true },
      });
      groupURLs = peers.map((p: { merchantURL: string }) => p.merchantURL);
    }

    // Cashback calculation for the new purchase (at processor merchant)
    const newCashbackAmt =
      merchant.earnType === "PERCENTAGE"
        ? purchaseAmount * (merchant.earnValue / 100)
        : merchant.earnValue;
    const expiryDate = new Date(
      now.getTime() + merchant.rebateValidityDays * 24 * 60 * 60 * 1000
    );

    // Commission calculation
    const commissionEarned =
      merchant.commissionType === "PERCENTAGE"
        ? purchaseAmount * (merchant.commissionValue / 100)
        : merchant.commissionValue;

    // Single transaction: redeem → purchase → new cashback → billing
    await prisma.$transaction(async (tx) => {
      // 1. Mark active cashbacks as redeemed
      await tx.cashback.updateMany({
        where: groupURLs
          ? { customerTelegramID, merchantURL: { in: groupURLs }, redeemed: false, expiryDate: { gte: now } }
          : { customerTelegramID, merchantURL: otp.merchantURL, redeemed: false, expiryDate: { gte: now } },
        data: { redeemed: true, redemptionDate: now },
      });

      // 2. Record the purchase
      await tx.purchase.create({
        data: {
          merchantURL: merchant.merchantURL,
          customerTelegramID,
          amount: purchaseAmount,
          rebateDeducted: otp.totalCashback,
          commissionEarned,
        },
      });

      // 3. Issue new cashback
      await tx.cashback.create({
        data: {
          merchantURL: merchant.merchantURL,
          customerTelegramID,
          cashbackAmt: newCashbackAmt,
          expiryDate,
        },
      });

      // 4. Accumulate commission into monthly billing
      await tx.monthlyBilling.upsert({
        where: { merchantURL_billingMonth: { merchantURL: merchant.merchantURL, billingMonth } },
        create: {
          merchantURL: merchant.merchantURL,
          billingMonth,
          totalCommission: commissionEarned,
          subscriptionFee: merchant.subscriptionFee,
          totalDue: commissionEarned + merchant.subscriptionFee,
        },
        update: {
          totalCommission: { increment: commissionEarned },
          totalDue: { increment: commissionEarned },
        },
      });

      // 5. Mark OTP used inside the transaction so concurrent retries fail
      await tx.otpSession.update({
        where: { id: otp.id },
        data: { used: true },
      });
    });

    // Fire-and-forget → n8n sends Telegram messages (resilience backup channel)
    // If the mini app is blocked, merchants still process via the Telegram bot flow,
    // but notifications always go through n8n regardless of which channel processed the redemption.
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    if (n8nUrl) {
      fetch(`${n8nUrl}/pan-cashback-issued`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "CASHBACK_ISSUED_WITH_REDEMPTION",
          customerTelegramID,
          merchantURL: merchant.merchantURL,
          merchantName: merchant.merchantName,
          purchaseAmount,
          redeemedAmount: otp.totalCashback,
          newCashbackAmt,
          expiryDate: expiryDate.toISOString(),
          commissionEarned,
        }),
      }).catch(() => {});
    }

    return ok({
      redeemedAmount: otp.totalCashback,
      newCashbackAmt,
      purchaseAmount,
      merchantName: merchant.merchantName,
      customerName: otp.customer.firstName ?? "Customer",
      expiryDate: expiryDate.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("initData") || msg.includes("signature") || msg.includes("header")) {
      return err(msg, 401);
    }
    console.error("[redeem]", e);
    return err("Internal error", 500);
  }
}
