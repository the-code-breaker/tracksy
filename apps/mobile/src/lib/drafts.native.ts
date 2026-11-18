import * as SQLite from "expo-sqlite";
import type { ExpenseInput } from "@tracksy/domain";
export interface Draft {
  id: string;
  user_id: string;
  payload: ExpenseInput;
  saved_at: string;
}
async function database() {
  const db = await SQLite.openDatabaseAsync("tracksy-drafts.db");
  await db.execAsync(
    "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, payload TEXT NOT NULL, saved_at TEXT NOT NULL)",
  );
  return db;
}
export async function saveDraft(user: string, payload: ExpenseInput) {
  const db = await database();
  await db.runAsync(
    "INSERT OR REPLACE INTO drafts(id,user_id,payload,saved_at) VALUES(?,?,?,?)",
    payload.idempotency_key,
    user,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}
export async function listDrafts(user: string): Promise<Draft[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    id: string;
    user_id: string;
    payload: string;
    saved_at: string;
  }>("SELECT * FROM drafts WHERE user_id=? ORDER BY saved_at DESC", user);
  return rows.map((d) => ({
    ...d,
    payload: JSON.parse(d.payload) as ExpenseInput,
  }));
}
export async function removeDraft(id: string) {
  const db = await database();
  await db.runAsync("DELETE FROM drafts WHERE id=?", id);
}
