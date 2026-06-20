import prisma from "@/lib/prisma";

// The single active voting round, or null when between rounds.
export async function getActiveEvent() {
  return prisma.event.findFirst({ where: { status: "active" } });
}
