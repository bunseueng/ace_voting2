// One-off: rename Legacy -> closed "First Event" (holds the 82 existing posters)
// and remove the leftover test events.
// Run: node scripts/promote-first-event.mjs
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany();
  const legacy = events.find((e) => e.name === "Legacy");
  if (!legacy) throw new Error("Legacy event not found");

  // Test events = everything except the Legacy event.
  const testEvents = events.filter((e) => e.id !== legacy.id);

  // Delete all data tied to the test events.
  for (const ev of testEvents) {
    await prisma.voting.deleteMany({ where: { eventId: ev.id } });
    await prisma.votingTally.deleteMany({ where: { eventId: ev.id } });
    await prisma.resultArchive.deleteMany({ where: { eventId: ev.id } });
    await prisma.poster.deleteMany({ where: { eventId: ev.id } });
    await prisma.event.delete({ where: { id: ev.id } });
    console.log("removed test event:", ev.name, ev.id);
  }

  // Rename Legacy -> closed "First Event" (mark done).
  const promoted = await prisma.event.update({
    where: { id: legacy.id },
    data: { name: "First Event", status: "closed", closedAt: new Date() },
  });
  console.log("event:", promoted.name, promoted.id, promoted.status);

  const activeCount = await prisma.event.count({ where: { status: "active" } });
  const posters = await prisma.poster.count({ where: { eventId: promoted.id } });
  console.log("active events:", activeCount, "| posters in First Event:", posters);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
