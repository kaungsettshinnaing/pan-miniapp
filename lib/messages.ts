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
  | "REDEMPTION_CANCELLED"
  | "EXPIRY_FIRST_REMINDER"
  | "EXPIRY_SECOND_REMINDER"
  | "FIRST_RECALL_CAMPAIGN"
  | "SECOND_RECALL_CAMPAIGN";

// Fallbacks when a merchant hasn't customised a template for a trigger.
const DEFAULTS: Partial<Record<MessageTriggerKey, string>> = {
  CASHBACK_ISSUED:
    "🎁 {{merchantName}}\n\nYour cashback balance: {{cashbackAmt}}\nYour PIN: {{pin}}\n\nShow this PIN to the cashier to redeem. Valid for this visit only.",
  CASHBACK_ISSUED_WITH_REDEMPTION:
    "✅ Thanks for visiting {{merchantName}}!\n\nPurchase: {{purchaseAmount}}\nCashback redeemed: {{redeemedAmt}}\nNew cashback earned: {{cashbackAmt}}\nValid until {{expiryDate}}.",
  REDEMPTION_FAILURE:
    "⚠️ Your redemption at {{merchantName}} could not be completed. Please try again or ask the cashier for help.",
  REDEMPTION_CANCELLED:
    "😔 Your cashback redemption at {{merchantName}} was cancelled. Come visit us again soon!",
  EXPIRY_FIRST_REMINDER:
    "⏰ Reminder from {{merchantName}}! Your cashback of {{cashbackAmt}} expires in {{reminderDays}} days ({{expiryDate}}). Visit us soon to redeem it!",
  EXPIRY_SECOND_REMINDER:
    "🚨 Last chance! Your cashback of {{cashbackAmt}} at {{merchantName}} expires in just {{reminderDays}} days ({{expiryDate}}). Don't let it go to waste!",
  FIRST_RECALL_CAMPAIGN:
    "👋 Hi {{customerName}}, we miss you at {{merchantName}}! It's been a while since your last visit. Come back and earn more cashback.",
  SECOND_RECALL_CAMPAIGN:
    "💫 {{customerName}}, {{merchantName}} misses you! We'd love to see you again — your loyalty means everything to us.",
};

// `trigger` is echoed back so n8n (and anyone reading the webhook body) can see
// which template produced this message at a glance.
export type ResolvedMessage = { trigger: MessageTriggerKey; text: string; imageURL: string | null };

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
    trigger,
    text: renderTemplate(raw, vars),
    imageURL: template?.imageURL ?? null,
  };
}
