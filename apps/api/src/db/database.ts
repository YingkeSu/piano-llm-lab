import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const apiRoot = path.resolve(path.dirname(__filename), "../..");
const dataDir = path.resolve(apiRoot, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, "piano.db");
export const db = new Database(dbFile);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL,
  user_id INTEGER,
  nickname TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_page_created ON comments(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
`);
