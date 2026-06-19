import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  // Duplicate votes: same device voted same poster more than once
  const votes = await prisma.voting.findMany({
    select: { id: true, deviceId: true, posterId: true, createdAt: true },
  });
  const voteMap = new Map();
  for (const v of votes) {
    const k = `${v.deviceId}|${v.posterId}`;
    if (!voteMap.has(k)) voteMap.set(k, []);
    voteMap.get(k).push(v);
  }
  const dupVotes = [...voteMap.values()].filter((a) => a.length > 1);

  // Duplicate tallies: same poster+choice more than one row
  const tallies = await prisma.votingTally.findMany();
  const tMap = new Map();
  for (const t of tallies) {
    const k = `${t.posterId}|${t.choice}`;
    if (!tMap.has(k)) tMap.set(k, []);
    tMap.get(k).push(t);
  }
  const dupTallies = [...tMap.values()].filter((a) => a.length > 1);

  console.log("VOTES total:", votes.length, "dup groups:", dupVotes.length);
  console.log("TALLIES total:", tallies.length, "dup groups:", dupTallies.length);
  console.log("DUP_VOTE_GROUPS", JSON.stringify(dupVotes.length));
  console.log("DUP_TALLY_GROUPS", JSON.stringify(dupTallies.length));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
