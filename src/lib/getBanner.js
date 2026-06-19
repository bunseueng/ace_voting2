import prisma from "@/lib/prisma";

export async function getBanner() {
  const setting = await prisma.setting.findUnique({ where: { key: "banner" } });
  return setting?.value || "/banner.jfif";
}
