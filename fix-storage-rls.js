#!/usr/bin/env node

const https = require('https');

const SUPABASE_URL = 'https://mxgcchhyjzgfyrbzwzon.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14Z2NjaGh5anpnZnlyYnp3em9uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODQxMTA4OCwiZXhwIjoyMDczOTg3MDg4fQ.OHgr5qTHkSuEmxuVnw4YYD2CeVcvtfP0pgXFZ0-LMVE';

const queries = [
  `DROP POLICY IF EXISTS "school_assets_upload" ON storage.objects`,
  `DROP POLICY IF EXISTS "school_assets_select" ON storage.objects`,
  `DROP POLICY IF EXISTS "school_assets_update" ON storage.objects`,
  `DROP POLICY IF EXISTS "school_assets_delete" ON storage.objects`,
  
  `CREATE POLICY "school_assets_upload" ON storage.objects
    FOR INSERT WITH CHECK (
      bucket_id = 'school-assets' AND
      (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'super_admin') OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid()
          AND role = 'school_admin'
          AND school_id::text = split_part(name, '/', 1)
          AND name !~ '\\.\\.\\' AND name !~ '/\\./' AND name !~ '^\\./'
        )
      ) AND
      (storage.extension(name) = ANY(ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif']))
    )`,

  `CREATE POLICY "school_assets_select" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'school-assets' AND
      (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'super_admin') OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid()
          AND school_id::text = split_part(name, '/', 1)
          AND name !~ '\\.\\.\\' AND name !~ '/\\./' AND name !~ '^\\./'
        )
      )
    )`,

  `CREATE POLICY "school_assets_update" ON storage.objects
    FOR UPDATE USING (
      bucket_id = 'school-assets' AND
      (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'super_admin') OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid()
          AND role = 'school_admin'
          AND school_id::text = split_part(name, '/', 1)
          AND name !~ '\\.\\.\\' AND name !~ '/\\./' AND name !~ '^\\./'
        )
      )
    )`,

  `CREATE POLICY "school_assets_delete" ON storage.objects
    FOR DELETE USING (
      bucket_id = 'school-assets' AND
      (
        EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'super_admin') OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid()
          AND role = 'school_admin'
          AND school_id::text = split_part(name, '/', 1)
          AND name !~ '\\.\\.\\' AND name !~ '/\\./' AND name !~ '^\\./'
        )
      )
    )`
];

async function executeQuery(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    
    const options = {
      hostname: 'mxgcchhyjzgfyrbzwzon.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, body });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Fixing storage RLS policies...\n');
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const policyName = query.includes('DROP') ? 'DROP' : query.match(/CREATE POLICY "([^"]+)"/)?.[1] || 'unknown';
    
    try {
      process.stdout.write(`${i + 1}/${queries.length} ${policyName}... `);
      await executeQuery(query);
      console.log('✅');
    } catch (error) {
      console.log('❌');
      console.error(`Error: ${error.message}`);
    }
  }
  
  console.log('\n✨ Done! Try uploading a file again.');
}

main().catch(console.error);
