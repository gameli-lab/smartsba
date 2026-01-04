#!/bin/bash

# Read environment variables
set -a
source /home/torvex/smartsba/.env.local
set +a

# Extract URL components
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
SUPABASE_KEY=$(grep "SUPABASE_SERVICE_ROLE_KEY" /home/torvex/smartsba/.env.local | cut -d'=' -f2)

if [ -z "$SUPABASE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY not found in .env.local"
  exit 1
fi

# Execute the migration SQL
cat /home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql | psql \
  "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -v ON_ERROR_STOP=1 2>&1

# Alternative: Use curl to run via the SQL API (if available)
# This is a placeholder for manual execution via Supabase dashboard or local psql
echo "Migration file created at: /home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql"
echo ""
echo "To apply this migration, you have two options:"
echo ""
echo "1. Via Supabase Dashboard:"
echo "   - Go to your Supabase project SQL Editor"
echo "   - Copy the SQL from the migration file"
echo "   - Run it in the editor"
echo ""
echo "2. Via local psql (if you have database access):"
echo "   - psql <your_database_url> < /home/torvex/smartsba/supabase/migrations/010_add_level_to_subjects.sql"
