CREATE TABLE daily_counts (
  day TEXT NOT NULL,
  package_version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('command', 'tool')),
  name TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'error')),
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (day, package_version, kind, name, outcome)
) WITHOUT ROWID;