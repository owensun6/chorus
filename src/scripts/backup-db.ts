// Author: be-domain-modeler
// Online backup using SQLite backup API (WAL-safe).
// Usage: node dist/scripts/backup-db.js <destination>
// Env:   CHORUS_DB_PATH (default: /data/chorus.db)
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env["CHORUS_DB_PATH"] ?? "/data/chorus.db";
const dest = process.argv[2];

if (!dest) {
  console.error("Usage: node dist/scripts/backup-db.js <destination-path>");
  console.error("  Env: CHORUS_DB_PATH (current: %s)", dbPath);
  process.exit(1);
}

if (!existsSync(dbPath)) {
  console.error("Source database not found: %s", dbPath);
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });

console.log("Source: %s", dbPath);
console.log("Destination: %s", dest);

const db = new Database(dbPath, { readonly: true });

db.backup(dest)
  .then(() => {
    db.close();
    console.log("Backup complete.");
  })
  .catch((err: unknown) => {
    db.close();
    console.error("Backup failed:", err);
    process.exit(1);
  });
