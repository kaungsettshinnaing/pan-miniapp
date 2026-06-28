import { getAuth } from "@/lib/web-auth";
import { ok, err } from "@/lib/api-response";

export async function GET(request: Request) {
  const auth = await getAuth(request);
  if (!auth) return err("Not authenticated", 401);
  return ok(auth);
}
