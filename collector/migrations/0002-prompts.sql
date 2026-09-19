CREATE TABLE daily_counts_with_prompts (
  day TEXT NOT NULL,
  package_version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('command', 'tool', 'prompt')),
  name TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'error')),
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (day, package_version, kind, name, outcome)
) WITHOUT ROWID;

INSERT INTO daily_counts_with_prompts (day, package_version, kind, name, outcome, count)
SELECT day, package_version, kind, name, outcome, count FROM daily_counts;

DROP TABLE daily_counts;
ALTER TABLE daily_counts_with_prompts RENAME TO daily_counts;