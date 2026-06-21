import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";

// Banner URL, cached (tag "banner") so it doesn't hit Mongo on every page.
// Invalidated when a new banner is uploaded via revalidateTag("banner").
export const getBanner = unstable_cache(
  async () => {
    const setting = await prisma.setting.findUnique({
      where: { key: "banner" },
    });
    return setting?.value || "/banner.jfif";
  },
  ["banner"],
  { tags: ["banner"], revalidate: 300 }
);
