import { clearSessionCookie } from "@/lib/web-auth";
import { ok } from "@/lib/api-response";

export async function POST() {
  await clearSessionCookie();
  return ok({ loggedOut: true });
}
