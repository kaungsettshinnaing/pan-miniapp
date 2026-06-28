import { parseTelegramUser } from "@/lib/telegram-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const merchant = await prisma.merchant.findFirst({
      where: { merchantTelegramID: String(user.id), active: true },
    });
    if (!merchant) return err("Not authorized as a merchant", 403);

    const templates = await prisma.messageTemplate.findMany({
      where: { merchantURL: merchant.merchantURL },
      orderBy: { trigger: "asc" },
    });
    return ok(templates);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg.includes("initData") ? 401 : 500);
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = parseTelegramUser(request, process.env.TELEGRAM_BOT_TOKEN!);
    const merchant = await prisma.merchant.findFirst({
      where: { merchantTelegramID: String(user.id), active: true },
    });
    if (!merchant) return err("Not authorized as a merchant", 403);

    const body = (await request.json()) as {
      trigger?: string;
      messageText?: string | null;
      imageURL?: string | null;
    };
    if (!body.trigger) return err("trigger is required", 400);

    const template = await prisma.messageTemplate.upsert({
      where: {
        merchantURL_platform_trigger: {
          merchantURL: merchant.merchantURL,
          platform: "TELEGRAM",
          trigger: body.trigger as never,
        },
      },
      create: {
        merchantURL: merchant.merchantURL,
        platform: "TELEGRAM",
        trigger: body.trigger as never,
        messageText: body.messageText ?? null,
        imageURL: body.imageURL ?? null,
      },
      update: {
        messageText: body.messageText ?? null,
        imageURL: body.imageURL ?? null,
      },
    });
    return ok(template);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg.includes("initData") ? 401 : 500);
  }
}
