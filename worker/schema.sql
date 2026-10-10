-- One row per sync key. The key itself never reaches the server: id = SHA-256 of it,
-- and data is AES-GCM ciphertext made on the device, so the server can't read names or hours.
CREATE TABLE IF NOT EXISTS sync (
  id         TEXT PRIMARY KEY,   -- 64 hex chars
  iv         TEXT NOT NULL,      -- base64, 12 bytes
  data       TEXT NOT NULL,      -- base64 ciphertext
  updated_at INTEGER NOT NULL,   -- client time of the edit (ms), last write wins
  written_at INTEGER NOT NULL    -- server time of the last write (ms), for expiry
);
CREATE INDEX IF NOT EXISTS sync_written_at ON sync (written_at);

-- User counter: one row per browser (a random id made on the device; no IP, no cookies),
-- plus a running total so showing the number never scans the table.
CREATE TABLE IF NOT EXISTS visitors (
  id         TEXT PRIMARY KEY,   -- 32 hex chars, random
  first_seen INTEGER NOT NULL    -- server time (ms)
);
CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO counters (name, value) VALUES ('users', 0);
