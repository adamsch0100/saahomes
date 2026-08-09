-- ListLogic accounts, trials, promo codes, invites, feedback

CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  max_redemptions INTEGER,
  redemptions INTEGER NOT NULL DEFAULT 0,
  trial_days INTEGER NOT NULL DEFAULT 60,
  presentation_limit INTEGER NOT NULL DEFAULT 3,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  brokerage TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'agent',
  status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TEXT,
  presentations_used INTEGER NOT NULL DEFAULT 0,
  presentation_limit INTEGER,
  promo_code_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id)
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT,
  promo_code_id TEXT,
  trial_days INTEGER NOT NULL DEFAULT 60,
  presentation_limit INTEGER NOT NULL DEFAULT 3,
  brokerage TEXT NOT NULL DEFAULT '',
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  message TEXT NOT NULL,
  page_url TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

CREATE TABLE IF NOT EXISTS presentations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  run_id TEXT NOT NULL UNIQUE,
  share_token TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  recommended_price REAL,
  months_of_inventory REAL,
  active_count INTEGER,
  under_contract_count INTEGER,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_presentations_user ON presentations(user_id);
CREATE INDEX IF NOT EXISTS idx_presentations_share ON presentations(share_token);
CREATE INDEX IF NOT EXISTS idx_presentations_run ON presentations(run_id);

CREATE TABLE IF NOT EXISTS magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'auth',
  promo_code TEXT NOT NULL DEFAULT '',
  invite_token TEXT NOT NULL DEFAULT '',
  next_path TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token_hash);
