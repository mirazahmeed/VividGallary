import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Populating usernames for existing users...");
  const users = await prisma.user.findMany();

  for (const user of users) {
    if (user.username) {
      console.log(`User ${user.email} already has username: ${user.username}`);
      continue;
    }

    const emailPrefix = user.email.split("@")[0];
    const baseName = (user.name || emailPrefix || "user")
      .toLowerCase()
      .replace(/[^a-z0-9_.]/g, "_");

    let username = baseName;
    let counter = 1;

    // Keep checking uniqueness
    while (true) {
      const existing = await prisma.user.findUnique({
        where: { username },
      });
      if (!existing && username !== "") {
        break;
      }
      username = `${baseName}_${counter}`;
      counter++;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { username },
    });
    console.log(`Updated user ${user.email} with username: ${username}`);
  }

  console.log("Usernames population complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
