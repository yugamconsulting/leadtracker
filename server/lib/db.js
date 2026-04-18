import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "server/data/billing-db.json");

function ensureDbFile() {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(
      dbPath,
      JSON.stringify({ subscriptions: [], billingRecords: [] }, null, 2),
      "utf8",
    );
  }
}

export function readDb() {
  ensureDbFile();
  const raw = fs.readFileSync(dbPath, "utf8");
  const parsed = JSON.parse(raw || "{}");
  return {
    subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
    billingRecords: Array.isArray(parsed.billingRecords) ? parsed.billingRecords : [],
  };
}

export function writeDb(nextDb) {
  ensureDbFile();
  fs.writeFileSync(dbPath, JSON.stringify(nextDb, null, 2), "utf8");
}

export function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
