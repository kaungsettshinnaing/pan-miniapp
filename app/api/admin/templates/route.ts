import { requireAdmin } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const merchantURL = searchParams.get("merchantURL");
    if (!merchantURL) return err("merchantURL is required", 400);
    const templates = await prisma.messageTemplate.findMany({
      where: { merchantURL },
      orderBy: { trigger: "asc" },
    });
    return ok(templates);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as {
      merchantURL?: string;
      trigger?: string;
      messageText?: string | null;
      imageURL?: string | null;
    };
    if (!body.merchantURL || !body.trigger) return err("merchantURL and trigger are required", 400);
    const { merchantURL, trigger, messageText, imageURL } = body;
    const template = await prisma.messageTemplate.upsert({
      where: { merchantURL_platform_trigger: { merchantURL, platform: "TELEGRAM", trigger: trigger as never } },
      create: { merchantURL, platform: "TELEGRAM", trigger: trigger as never, messageText: messageText ?? null, imageURL: imageURL ?? null },
      update: { messageText: messageText ?? null, imageURL: imageURL ?? null },
    });
    return ok(template);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
