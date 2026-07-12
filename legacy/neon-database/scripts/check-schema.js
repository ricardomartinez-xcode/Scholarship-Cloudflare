const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DIRECT_URL);

console.log('[vercel-build] Ensuring recalc_admin schema exists in Neon...');

sql`CREATE SCHEMA IF NOT EXISTS recalc_admin`
  .then(() => { 
    console.log('[vercel-build] Schema recalc_admin ready.'); 
    process.exit(0); 
  })
  .catch(err => { 
    console.error('[vercel-build] Schema error:', err.message); 
    process.exit(1); 
  });
