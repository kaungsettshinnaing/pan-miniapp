import { requireAdmin } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { upsertSetting } from "@/lib/settings";
import { ok, err } from "@/lib/api-response";

const ALLOWED_KEYS = ["N8N_WEBHOOK_URL", "DEFAULT_BOT_TOKEN", "CASHBACK_APP_NAME"];

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const rows = await prisma.platformSetting.findMany({ orderBy: { key: "asc" } });
    return ok(rows);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as { key?: string; value?: string };
    if (!body.key || !ALLOWED_KEYS.includes(body.key)) return err(`key must be one of: ${ALLOWED_KEYS.join(", ")}`, 400);
    if (body.value === undefined) return err("value is required", 400);
    return ok(await upsertSetting(body.key, body.value));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
