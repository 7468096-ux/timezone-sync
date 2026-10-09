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
