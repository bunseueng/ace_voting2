import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$runCommandRaw({
    update: "Poster",
    updates: [
      {
        q: { status: { $exists: false } },
        u: { $set: { status: "progressing" } },
        multi: true,
      },
    ],
  });
  console.log("backfill result:", JSON.stringify(res));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
