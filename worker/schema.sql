-- Single-row data store for a 1-user personal finance app.
-- The entire SpendiaryData blob lives in one JSON column.
CREATE TABLE IF NOT EXISTS app_data (
  id          TEXT    PRIMARY KEY,  -- always 'main'
  payload     TEXT    NOT NULL,     -- JSON string of SpendiaryData
  updated_at  INTEGER NOT NULL      -- Unix ms timestamp
);
