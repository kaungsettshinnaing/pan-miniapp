import { createHmac } from "crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type ParsedInitData = {
  user: TelegramUser;
  auth_date: number;
  hash: string;
  query_id?: string;
  start_param?: string;
};

const MAX_AGE_SECONDS = 3600; // initData expires after 1 hour

export function verifyTelegramInitData(
  rawInitData: string,
  botToken: string
): ParsedInitData {
  const params = new URLSearchParams(rawInitData);
  const hash = params.get("hash");
  if (!hash) throw new Error("Missing hash in initData");

  // Build the data-check-string: sorted key=value pairs excluding hash
  params.delete("hash");
  const pairs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  // HMAC-SHA256 with key = HMAC-SHA256("WebAppData", botToken)
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (expectedHash !== hash) throw new Error("Invalid initData signature");

  // Check freshness
  const authDate = parseInt(params.get("auth_date") ?? "0", 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > MAX_AGE_SECONDS) throw new Error("initData expired");

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Missing user in initData");

  return {
    user: JSON.parse(userRaw) as TelegramUser,
    auth_date: authDate,
    hash,
    query_id: params.get("query_id") ?? undefined,
    start_param: params.get("start_param") ?? undefined,
  };
}

export function parseTelegramUser(
  request: Request,
  botToken: string
): ParsedInitData {
  const rawInitData = request.headers.get("x-telegram-init-data");
  if (!rawInitData) throw new Error("Missing x-telegram-init-data header");
  return verifyTelegramInitData(rawInitData, botToken);
}
