CREATE TABLE auth_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL UNIQUE REFERENCES educators(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_auth_sessions_account ON auth_sessions(account_id);
--> statement-breakpoint
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
--> statement-breakpoint
CREATE TABLE auth_limits (key TEXT PRIMARY KEY NOT NULL, started_at INTEGER NOT NULL, attempts INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX idx_auth_limits_expiry ON auth_limits(started_at);
