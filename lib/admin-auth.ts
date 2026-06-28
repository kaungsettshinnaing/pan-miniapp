import { parseTelegramUser } from "./telegram-auth";

export function getAdminIds(): string[] {
  return (process.env.ADMIN_TELEGRAM_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseAdminUser(request: Request, botToken: string) {
  const parsed = parseTelegramUser(request, botToken);
  const telegramID = String(parsed.user.id);
  if (!getAdminIds().includes(telegramID)) {
    throw new Error("Forbidden: not an admin");
  }
  return { ...parsed, telegramID };
}
