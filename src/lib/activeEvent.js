import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";

// The single active voting round, or null when between rounds.
// Cached in the data cache (tag "active-event") so it doesn't hit Mongo on
// every navigation. Invalidated by event open/close/delete via
// revalidateTag("active-event"). The 30s TTL is just a safety net.
export const getActiveEvent = unstable_cache(
  async () => prisma.event.findFirst({ where: { status: "active" } }),
  ["active-event"],
  { tags: ["active-event"], revalidate: 30 }
);
