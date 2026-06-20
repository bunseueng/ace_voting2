// Backfill all legacy data into one closed "Legacy" event.
// Run once: node scripts/migrate-legacy-event.mjs
import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  // Reuse existing Legacy event if the script is re-run.
  let legacy = await prisma.event.findFirst({ where: { name: "Legacy" } });
  if (!legacy) {
    legacy = await prisma.event.create({
      data: { name: "Legacy", status: "closed", closedAt: new Date() },
    });
  }
  const id = { $oid: legacy.id };

  for (const coll of ["Poster", "Voting", "VotingTally", "ResultArchive"]) {
    const res = await prisma.$runCommandRaw({
      update: coll,
      updates: [
        {
          q: { eventId: { $exists: false } },
          u: { $set: { eventId: id } },
          multi: true,
        },
      ],
    });
    console.log(`${coll}:`, JSON.stringify(res));
  }
  console.log("Legacy event id:", legacy.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
