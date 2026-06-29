/**
 * Substitutes {{variable}} placeholders in a message template.
 * Supports: {{cashbackAmt}}, {{redeemedAmt}}, {{expiryDate}}, {{merchantName}},
 *           {{purchaseAmount}}, {{customerName}}, {{reminderDays}}, {{pin}}
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

export function formatKs(amount: number): string {
  return `Ks ${amount.toLocaleString("en-US")}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
