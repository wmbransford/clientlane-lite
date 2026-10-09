import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
const path = process.env.DATABASE_PATH || resolve(".data/clientlane.sqlite");
mkdirSync(dirname(path), { recursive: true });
export const db = new Database(path);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.exec(`
 CREATE TABLE IF NOT EXISTS crm_workspaces (id TEXT PRIMARY KEY, owner_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS crm_records (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id), kind TEXT NOT NULL,
 body TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived_at TEXT);
 CREATE INDEX IF NOT EXISTS crm_records_workspace ON crm_records(workspace_id,kind,archived_at);
 CREATE TABLE IF NOT EXISTS crm_settings (workspace_id TEXT PRIMARY KEY REFERENCES crm_workspaces(id), body TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS crm_automation_runs (workspace_id TEXT NOT NULL, deal_id TEXT NOT NULL, deal_version INTEGER NOT NULL, rule_id TEXT NOT NULL, PRIMARY KEY(workspace_id,deal_id,deal_version,rule_id));
 CREATE TABLE IF NOT EXISTS crm_recovery_keys (user_id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS crm_recovery_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS crm_activity (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id), record_id TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS crm_activity_workspace ON crm_activity(workspace_id,created_at);
`);
