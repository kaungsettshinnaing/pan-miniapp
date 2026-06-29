import { requireMerchantAccess } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { ok, err } from "@/lib/api-response";
import { resolveMerchantMessage } from "@/lib/messages";
import { formatKs, formatDate } from "@/lib/templates";

export async function POST(request: Request) {
  try {
    // Body must be read before requireMerchantAccess (guards only read headers/cookies)
    const body = (await request.json()) as {
      otpCode?: string | number;
      purchaseAmount?: number;
      merchantURL?: string;
    };
    const otpCode = body.otpCode != null ? String(body.otpCode) : undefined;
    const { purchaseAmount } = body;

    if (!otpCode || !purchaseAmount || purchaseAmount <= 0) {
      return err("otpCode and purchaseAmount are required", 400);
    }

    // Auth: normal merchant (Telegram initData or JWT) OR n8n internal call (API secret)
    let merchantURL: string;
    let merchantURLs: string[];
    const apiSecret = request.headers.get("x-api-secret");
    if (apiSecret && process.env.API_SECRET && apiSecret === process.env.API_SECRET) {
      if (!body.merchantURL) return err("merchantURL required for API secret auth", 400);
      merchantURL = body.merchantURL;
      merchantURLs = [merchantURL];
    } else {
      const access = await requireMerchantAccess(request);
      merchantURL = access.merchantURL;
      merchantURLs = access.merchantURLs;
    }

    // Full merchant config for the processor's outlet
    const merchant = await prisma.merchant.findUnique({ where: { merchantURL } });
    if (!merchant || !merchant.active) return err("Not authorized as a merchant", 403);

    // Fetch the OTP session
    const otp = await prisma.otpSession.findFirst({
      where: { otpCode, used: false, expiresAt: { gte: new Date() } },
      include: {
        customer: { select: { customerTelegramID: true, firstName: true } },
      },
    });
    if (!otp) {
      // Invalid OTP can't identify the customer, but the n8n combined workflow
      // still holds the earn-context chatId, so hand it the resolved failure
      // message to forward to the customer.
      const customerMessage = await resolveMerchantMessage(
        merchant.merchantURL,
        "REDEMPTION_FAILURE",
        { merchantName: merchant.merchantName }
      );
      return err("Invalid or expired PIN", 400, { customerMessage });
    }

    // Authorize: OTP must be for a merchant the caller can access (same outlet or same group)
    if (!merchantURLs.includes(otp.merchantURL)) {
      return err("This PIN was not issued for your merchant", 403);
    }

    const { customerTelegramID } = otp;
    const now = new Date();
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Fetch originalPurchaseAmount from the active cashback being redeemed.
    // Needed for INITIAL_TRANSACTION commission basis (commission on the purchase that generated
    // the cashback, not the current visit). Defaults to 0 for historical/first-visit data.
    const activeCashback = await prisma.cashback.findFirst({
      where: {
        customerTelegramID,
        merchantURL: { in: merchantURLs },
        redeemed: false,
        expiryDate: { gte: now },
      },
      select: { originalPurchaseAmount: true },
    });
    const originalPurchaseAmount = activeCashback?.originalPurchaseAmount ?? 0;

    // NET purchase = gross minus redeemed cashback (clamped to 0)
    const netPurchase = Math.max(0, purchaseAmount - otp.totalCashback);

    // New cashback on NET purchase only; net=0 → no cashback
    const newCashbackAmt =
      netPurchase === 0
        ? 0
        : merchant.earnType === "PERCENTAGE"
        ? netPurchase * (merchant.earnValue / 100)
        : merchant.earnValue;

    const expiryDate = new Date(
      now.getTime() + merchant.rebateValidityDays * 24 * 60 * 60 * 1000
    );

    // Commission: FLAT is always flat rate; PERCENTAGE depends on commissionBasis
    //   RETURN_TRANSACTION  → % of current visit's gross purchase
    //   INITIAL_TRANSACTION → % of the purchase that generated the cashback being redeemed
    const commissionBase =
      merchant.commissionType === "PERCENTAGE"
        ? merchant.commissionBasis === "RETURN_TRANSACTION"
          ? purchaseAmount
          : originalPurchaseAmount
        : null;
    const commissionEarned =
      merchant.commissionType === "FLAT"
        ? merchant.commissionValue
        : (commissionBase ?? 0) * (merchant.commissionValue / 100);

    // Single transaction: redeem → purchase → new cashback → billing → mark OTP used
    await prisma.$transaction(async (tx) => {
      // 1. Mark active cashbacks as redeemed
      await tx.cashback.updateMany({
        where: {
          customerTelegramID,
          merchantURL: { in: merchantURLs },
          redeemed: false,
          expiryDate: { gte: now },
        },
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

      // 3. Issue new cashback (skipped when net = 0)
      if (newCashbackAmt > 0) {
        await tx.cashback.create({
          data: {
            merchantURL: merchant.merchantURL,
            customerTelegramID,
            cashbackAmt: newCashbackAmt,
            originalPurchaseAmount: purchaseAmount, // stored so next visit can use INITIAL commission
            expiryDate,
          },
        });
      }

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

      // 5. Mark OTP used so concurrent retries fail
      await tx.otpSession.update({
        where: { id: otp.id },
        data: { used: true },
      });
    });

    // Resolve the customer's branded success message. Fired by the backend (not n8n)
    // so the customer is notified no matter which path the cashier used to redeem
    // (n8n Telegram form OR the in-app merchant tab).
    const customerName = otp.customer.firstName ?? "Customer";
    const customerMessage = await resolveMerchantMessage(
      merchant.merchantURL,
      "CASHBACK_ISSUED_WITH_REDEMPTION",
      {
        cashbackAmt: formatKs(newCashbackAmt),
        purchaseAmount: formatKs(purchaseAmount),
        expiryDate: formatDate(expiryDate),
        merchantName: merchant.merchantName,
        customerName,
      }
    );

    // Fire-and-forget → n8n sends Telegram messages to customer
    const n8nUrl = await getSetting("N8N_WEBHOOK_URL");
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
          netPurchase,
          newCashbackAmt,
          expiryDate: newCashbackAmt > 0 ? expiryDate.toISOString() : null,
          commissionEarned,
          customerMessage,
        }),
      }).catch(() => {});
    }

    return ok({
      redeemedAmount: otp.totalCashback,
      netPurchase,
      newCashbackAmt,
      purchaseAmount,
      merchantName: merchant.merchantName,
      customerName,
      expiryDate: newCashbackAmt > 0 ? expiryDate.toISOString() : null,
      expiryDateFormatted: newCashbackAmt > 0 ? formatDate(expiryDate) : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return err(msg, 401);
    if (msg === "Forbidden") return err(msg, 403);
    console.error("[redeem]", e);
    return err("Internal error", 500);
  }
}
