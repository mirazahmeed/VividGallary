import fs from "fs";
import path from "path";

const srcDir = path.join(process.cwd(), "public", "uploads");
const destDir = path.join(process.cwd(), "storage", "uploads");

console.log("Starting uploads migration...");
console.log(`Source directory: ${srcDir}`);
console.log(`Destination directory: ${destDir}`);

if (!fs.existsSync(srcDir)) {
  console.log("Source directory 'public/uploads' does not exist. No files to migrate.");
  process.exit(0);
}

if (!fs.existsSync(destDir)) {
  console.log("Creating destination directory 'storage/uploads'...");
  fs.mkdirSync(destDir, { recursive: true });
}

try {
  const files = fs.readdirSync(srcDir);
  let migratedCount = 0;

  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);

    const stat = fs.statSync(srcFile);
    if (stat.isFile()) {
      console.log(`Migrating: ${file}`);
      fs.renameSync(srcFile, destFile);
      migratedCount++;
    }
  }

  console.log(`Migration complete! Successfully migrated ${migratedCount} files.`);
} catch (error) {
  console.error("Migration failed with error:", error);
  process.exit(1);
}
