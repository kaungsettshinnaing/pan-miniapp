import { prisma } from "./prisma";

// Read a platform setting from DB; fall back to env var
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? process.env[key] ?? null;
}

export async function upsertSetting(key: string, value: string) {
  return prisma.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
