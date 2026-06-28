import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/web-auth";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";

const SELECT = {
  id: true, username: true, role: true,
  merchantURL: true, redemptionGroupID: true, profitSharePct: true,
  createdAt: true,
} as const;

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const users = await prisma.webUser.findMany({ orderBy: { username: "asc" }, select: SELECT });
    return ok(users);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as {
      username?: string; password?: string; role?: string;
      merchantURL?: string | null; redemptionGroupID?: string | null; profitSharePct?: number | null;
    };
    if (!body.username || !body.password || !body.role) return err("username, password, and role are required", 400);
    if (!["ADMIN", "MERCHANT", "CHANNEL_PARTNER"].includes(body.role)) return err("invalid role", 400);

    const exists = await prisma.webUser.findUnique({ where: { username: body.username } });
    if (exists) return err("username already taken", 409);

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.webUser.create({
      data: {
        username: body.username,
        passwordHash,
        role: body.role as never,
        merchantURL: body.merchantURL ?? null,
        redemptionGroupID: body.redemptionGroupID ?? null,
        profitSharePct: body.profitSharePct ?? null,
      },
      select: SELECT,
    });
    return ok(user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const body = (await request.json()) as { id?: string; password?: string; profitSharePct?: number | null };
    if (!body.id) return err("id is required", 400);
    const data: Record<string, unknown> = {};
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 12);
    if (body.profitSharePct !== undefined) data.profitSharePct = body.profitSharePct;
    await prisma.webUser.update({ where: { id: body.id }, data });
    return ok({ updated: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return err("id is required", 400);
    await prisma.webUser.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return err(msg, msg === "Forbidden" ? 403 : msg === "Unauthorized" ? 401 : 500);
  }
}
