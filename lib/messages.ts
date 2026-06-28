import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/templates";

/**
 * Backend is the single source of truth for customer-facing Telegram messages.
 * It reads the merchant's MessageTemplate, fills in {{variables}}, and returns
 * ready-to-send { text, imageURL } so n8n only has to forward it. This keeps the
 * message identical no matter how the flow was triggered (mini-app vs bot text)
 * or how the redemption was processed (n8n form vs in-app merchant tab).
 */

export type MessageTriggerKey =
  | "CASHBACK_ISSUED"
  | "CASHBACK_ISSUED_WITH_REDEMPTION"
  | "REDEMPTION_FAILURE"
  | "EXPIRY_FIRST_REMINDER"
  | "EXPIRY_SECOND_REMINDER"
  | "FIRST_RECALL_CAMPAIGN"
  | "SECOND_RECALL_CAMPAIGN";

// Fallbacks when a merchant hasn't customised a template for a trigger.
const DEFAULTS: Partial<Record<MessageTriggerKey, string>> = {
  CASHBACK_ISSUED:
    "🎁 {{merchantName}}\n\nYour cashback balance: {{cashbackAmt}}\nYour PIN: {{pin}}\n\nShow this PIN to the cashier to redeem. Valid for this visit only.",
  CASHBACK_ISSUED_WITH_REDEMPTION:
    "✅ Thanks for visiting {{merchantName}}!\n\nPurchase: {{purchaseAmount}}\nNew cashback earned: {{cashbackAmt}}\nValid until {{expiryDate}}.",
  REDEMPTION_FAILURE:
    "⚠️ Your redemption at {{merchantName}} could not be completed. Please try again or ask the cashier for help.",
};

export type ResolvedMessage = { text: string; imageURL: string | null };

export async function resolveMerchantMessage(
  merchantURL: string,
  trigger: MessageTriggerKey,
  vars: Record<string, string | number>
): Promise<ResolvedMessage> {
  const template = await prisma.messageTemplate.findUnique({
    where: {
      merchantURL_platform_trigger: {
        merchantURL,
        platform: "TELEGRAM",
        trigger: trigger as never,
      },
    },
  });
  const raw = template?.messageText ?? DEFAULTS[trigger] ?? "";
  return {
    text: renderTemplate(raw, vars),
    imageURL: template?.imageURL ?? null,
  };
}
