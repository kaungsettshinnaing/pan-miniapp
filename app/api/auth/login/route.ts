import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie } from "@/lib/web-auth";
import { ok, err } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    if (!body.username || !body.password) return err("username and password are required", 400);

    const user = await prisma.webUser.findUnique({ where: { username: body.username } });
    if (!user) return err("Invalid username or password", 401);

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return err("Invalid username or password", 401);

    const token = await signSession({
      sub: user.id,
      role: user.role as "ADMIN" | "MERCHANT",
      merchantURL: user.merchantURL,
      username: user.username,
    });

    await setSessionCookie(token);

    return ok({ role: user.role, merchantURL: user.merchantURL, username: user.username });
  } catch (e) {
    console.error("[auth/login]", e);
    return err("Internal error", 500);
  }
}
