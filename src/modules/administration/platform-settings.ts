import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export const PLATFORM_FLAGS = {
  aiEnabled: "ai.globalEnabled",
} as const;

export async function getPlatformSetting<T extends Prisma.JsonValue>(key: string, fallback: T): Promise<T> {
  const setting = await prisma.platformSetting.findUnique({ where: { key } });
  return (setting?.value as T | undefined) ?? fallback;
}

export async function setPlatformSetting(key: string, value: Prisma.InputJsonValue, updatedById: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value, updatedById },
    create: { key, value, updatedById },
  });
}
