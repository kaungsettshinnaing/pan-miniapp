import { requireAdmin } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const groups = await prisma.redemptionGroup.findMany({
      orderBy: { groupName: "asc" },
      select: { id: true, groupName: true },
    });
    return ok(groups);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
