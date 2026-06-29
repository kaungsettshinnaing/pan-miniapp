import { requireChannelPartner } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const { cpId } = await requireChannelPartner(request);
    const url = new URL(request.url);
    const merchantURL = url.searchParams.get("merchantURL");
    if (!merchantURL) return err("merchantURL required", 400);

    const merchant = await prisma.merchant.findFirst({
      where: { merchantURL, channelPartnerID: cpId },
    });
    if (!merchant) return err("Merchant not found", 404);

    const templates = await prisma.messageTemplate.findMany({
      where: { merchantURL, platform: "TELEGRAM" },
    });
    return ok(templates);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return err(msg, 401);
    if (msg === "Forbidden") return err(msg, 403);
    return err("Internal error", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const { cpId } = await requireChannelPartner(request);
    const body = await request.json();
    const { merchantURL, trigger, messageText, imageURL } = body;
    if (!merchantURL || !trigger) return err("merchantURL and trigger required", 400);

    const merchant = await prisma.merchant.findFirst({
      where: { merchantURL, channelPartnerID: cpId },
    });
    if (!merchant) return err("Merchant not found", 404);

    const template = await prisma.messageTemplate.upsert({
      where: { merchantURL_platform_trigger: { merchantURL, platform: "TELEGRAM", trigger } },
      create: { merchantURL, platform: "TELEGRAM", trigger, messageText: messageText || null, imageURL: imageURL || null },
      update: { messageText: messageText || null, imageURL: imageURL || null },
    });
    return ok(template);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Unauthorized") return err(msg, 401);
    if (msg === "Forbidden") return err(msg, 403);
    return err("Internal error", 500);
  }
}
