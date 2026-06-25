CREATE TABLE IF NOT EXISTS stop_reports (
  id TEXT PRIMARY KEY,
  stop_id TEXT NOT NULL,
  contributor TEXT NOT NULL DEFAULT '',
  visited_on TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  sign_pole INTEGER,
  sign_shelter INTEGER,
  sign_stand INTEGER,
  sign_none INTEGER,
  seating INTEGER,
  shelter INTEGER,
  shade INTEGER,
  environment_bus_bay INTEGER,
  environment_street INTEGER,
  environment_parking_lot INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stop_reports_stop_created_at
  ON stop_reports (stop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stop_snapshots (
  stop_id TEXT PRIMARY KEY,
  stop_name TEXT NOT NULL,
  feed_stop_id TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  contributor TEXT NOT NULL DEFAULT '',
  visited_on TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sign_pole INTEGER,
  sign_shelter INTEGER,
  sign_stand INTEGER,
  sign_none INTEGER,
  seating INTEGER,
  shelter INTEGER,
  shade INTEGER,
  environment_bus_bay INTEGER,
  environment_street INTEGER,
  environment_parking_lot INTEGER
);

CREATE INDEX IF NOT EXISTS idx_stop_snapshots_updated_at
  ON stop_snapshots (updated_at DESC);
