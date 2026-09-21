CREATE TABLE daily_counts_with_error_categories (
  day TEXT NOT NULL,
  package_version TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('command', 'tool', 'prompt')),
  name TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'error')),
  error_category TEXT NOT NULL CHECK (
    error_category IN (
      'none',
      'unknown',
      'api_auth',
      'api_rate_limit',
      'api_client',
      'api_server',
      'network',
      'invalid_data',
      'output_contract',
      'unexpected'
    )
    AND (
      (outcome = 'success' AND error_category = 'none')
      OR (outcome = 'error' AND kind != 'tool' AND error_category = 'none')
      OR (outcome = 'error' AND kind = 'tool' AND error_category != 'none')
    )
  ),
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (day, package_version, kind, name, outcome, error_category)
) WITHOUT ROWID;

INSERT INTO daily_counts_with_error_categories (
  day,
  package_version,
  kind,
  name,
  outcome,
  error_category,
  count
)
SELECT
  day,
  package_version,
  kind,
  name,
  outcome,
  CASE WHEN outcome = 'error' AND kind = 'tool' THEN 'unknown' ELSE 'none' END,
  count
FROM daily_counts;

DROP TABLE daily_counts;
ALTER TABLE daily_counts_with_error_categories RENAME TO daily_counts;
