import { requireAdmin } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const merchants = await prisma.merchant.findMany({
      orderBy: { merchantName: "asc" },
      include: { redemptionGroup: { select: { groupName: true } } },
    });
    return ok(merchants);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as { merchantURL?: string } & Record<string, unknown>;
    if (!body.merchantURL) return err("merchantURL is required", 400);
    const { merchantURL, ...data } = body;
    const merchant = await prisma.merchant.update({
      where: { merchantURL },
      data: data as Parameters<typeof prisma.merchant.update>[0]["data"],
    });
    return ok(merchant);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
