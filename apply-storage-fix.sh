#!/usr/bin/env bash
set -euo pipefail

MIGRATION_FILE="/home/torvex/smartsba/supabase/migrations/999_fix_storage_policies_without_custom_claims.sql"
DATABASE_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DATABASE_URL" ]]; then
  cat <<'EOF'
Missing database connection string.

To automate this locally or in CI, set one of:
  - SUPABASE_DB_URL
  - DATABASE_URL

Example:
  export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
  ./apply-storage-fix.sh

EOF
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but was not found in PATH."
  exit 1
fi

echo "Applying storage policy migration: $MIGRATION_FILE"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"

echo "Done. Next, verify the school-assets bucket policies and get_school_asset_url function in Supabase."
