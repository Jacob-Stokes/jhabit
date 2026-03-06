import Database from 'better-sqlite3';

const APP_NAME = process.env.APP_NAME || 'jhabit';
const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || `./data/${APP_NAME}.db`;

export const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const SCHEMA = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  is_admin INTEGER DEFAULT 0,
  allow_query_param_auth INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- API Keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth tables for remote MCP endpoint
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret TEXT,
  client_secret_expires_at INTEGER DEFAULT 0,
  redirect_uris TEXT NOT NULL,
  client_name TEXT,
  client_uri TEXT,
  grant_types TEXT,
  response_types TEXT,
  token_endpoint_auth_method TEXT DEFAULT 'client_secret_post',
  scope TEXT,
  client_id_issued_at INTEGER,
  client_metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT DEFAULT 'S256',
  scopes TEXT,
  resource TEXT,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  token TEXT PRIMARY KEY,
  token_type TEXT NOT NULL CHECK(token_type IN ('access', 'refresh')),
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scopes TEXT,
  resource TEXT,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_auth_codes_expires ON oauth_auth_codes(expires_at);

-- ─── Trackers (habits and quits) ───────────────────────────────
CREATE TABLE IF NOT EXISTS trackers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('habit', 'quit')),
  emoji TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trackers_user ON trackers(user_id);

-- Entries: for habits = completion logs, for quits = slip-up logs
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  tracker_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tracker_id) REFERENCES trackers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entries_tracker ON entries(tracker_id);
CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries(timestamp);
`;

export function initDatabase() {
  db.exec(SCHEMA);
  console.log('Database initialized at:', DB_PATH);
}

// Types
export interface User {
  id: string;
  username: string;
  password_hash: string;
  email: string | null;
  is_admin: number;
  allow_query_param_auth: number;
  created_at: string;
  updated_at: string;
}

export interface Tracker {
  id: string;
  user_id: string;
  name: string;
  type: 'habit' | 'quit';
  emoji: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  tracker_id: string;
  user_id: string;
  timestamp: string;
  note: string | null;
  created_at: string;
}
