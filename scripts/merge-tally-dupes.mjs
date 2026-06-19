import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const tallies = await prisma.votingTally.findMany();
  const map = new Map();
  for (const t of tallies) {
    const k = `${t.posterId}|${t.choice}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t);
  }

  for (const [k, group] of map) {
    if (group.length <= 1) continue;
    const total = group.reduce((s, t) => s + t.number, 0);
    const keep = group[0];
    const drop = group.slice(1).map((t) => t.id);

    await prisma.$transaction([
      prisma.votingTally.update({
        where: { id: keep.id },
        data: { number: total },
      }),
      prisma.votingTally.deleteMany({ where: { id: { in: drop } } }),
    ]);
    console.log(`merged ${k}: ${group.length} rows -> number=${total}`);
  }
  console.log("done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
