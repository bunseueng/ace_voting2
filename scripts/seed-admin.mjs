// Seed/upsert the admin account. Run: node scripts/seed-admin.mjs
import { PrismaClient } from "../src/generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Pass via env or CLI: ADMIN_SEED_USER, ADMIN_SEED_PASS
//   node scripts/seed-admin.mjs <username> <password>
const USERNAME = process.argv[2] || process.env.ADMIN_SEED_USER || "admin";
const PASSWORD = process.argv[3] || process.env.ADMIN_SEED_PASS;

async function main() {
  if (!PASSWORD) {
    console.error(
      "Missing password. Usage: node scripts/seed-admin.mjs <username> <password>\n" +
        "or set ADMIN_SEED_PASS env var."
    );
    process.exit(1);
  }
  const hashed = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { username: USERNAME },
    update: { password: hashed, role: "Admin" },
    create: {
      username: USERNAME,
      name: "Admin",
      password: hashed,
      role: "Admin",
    },
  });
  console.log("Admin ready:", { id: user.id, username: user.username, role: user.role });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
