// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — DATABASE (Supabase)
// Replaces sql.js with the Supabase client.
// All other files (scheduler, sender, reporter, server) are unchanged.
//
// Add to .env:
//   SUPABASE_URL=https://yourproject.supabase.co
//   SUPABASE_ANON_KEY=your-anon-key
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service_role key — bypasses RLS, server-side only
);

// ── HELPERS ───────────────────────────────────────────────────────────────────
// These mirror the sql.js helper signatures so the rest of the codebase
// doesn't need to change at all.

/**
 * Run an INSERT, UPDATE, or DELETE via raw SQL.
 * Uses Supabase's rpc with a helper function, or direct table methods.
 * We expose a lightweight wrapper that accepts raw SQL for compatibility.
 */
async function dbRun(sql, params = []) {
  const { error } = await supabase.rpc('exec_sql', { sql, params });
  if (error) throw new Error(`dbRun error: ${error.message}\nSQL: ${sql}`);
}

/**
 * Fetch a single row. Returns the first result or undefined.
 */
async function dbGet(table, filters = {}, columns = '*') {
  let query = supabase.from(table).select(columns);
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query.limit(1).single();
  if (error && error.code !== 'PGRST116') throw new Error(`dbGet error: ${error.message}`);
  return data || undefined;
}

/**
 * Fetch multiple rows.
 */
async function dbAll(table, filters = {}, columns = '*', opts = {}) {
  let query = supabase.from(table).select(columns);
  for (const [col, val] of Object.entries(filters)) {
    if (Array.isArray(val)) {
      query = query.in(col, val);
    } else {
      query = query.eq(col, val);
    }
  }
  if (opts.order)  query = query.order(opts.order, { ascending: opts.ascending ?? true });
  if (opts.limit)  query = query.limit(opts.limit);
  const { data, error } = await query;
  if (error) throw new Error(`dbAll error: ${error.message}`);
  return data || [];
}

/**
 * Insert a row. Returns the inserted row (with generated id).
 */
async function dbInsert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw new Error(`dbInsert error: ${error.message}\nTable: ${table}`);
  return data;
}

/**
 * Update rows matching filters.
 */
async function dbUpdate(table, filters, updates) {
  let query = supabase.from(table).update(updates);
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  const { error } = await query;
  if (error) throw new Error(`dbUpdate error: ${error.message}`);
}

// ── SEED: sync prospects.js into Supabase ─────────────────────────────────────

async function initAndSeed() {
  const prospectList = require('../config/prospects');
  const now = new Date().toISOString();

  console.log('🔄  Syncing prospects to Supabase...');

  for (const p of prospectList) {
    const { error } = await supabase.from('prospects').upsert({
      id:             p.id,
      company:        p.company,
      first_name:     p.first_name,
      last_name:      p.last_name,
      email:          p.email,
      title:          p.title,
      vertical:       p.vertical,
      prospect_type:  p.prospect_type,
      status:         p.status || 'active',
      notes:          p.notes || null,
      added_at:       now,
    }, {
      onConflict: 'id',
      ignoreDuplicates: false,   // update existing rows
    });
    if (error) console.error(`  ✗ Failed to upsert ${p.company}: ${error.message}`);
  }

  const { count } = await supabase.from('prospects').select('*', { count: 'exact', head: true });
  console.log(`✅  Synced — ${count} prospects in Supabase`);
}

// ── RUN LOG ───────────────────────────────────────────────────────────────────

async function startRun(mode = 'cli') {
  const row = await dbInsert('run_log', { mode, status: 'running' });
  return row.id;
}

async function endRun(runId, summary = {}) {
  await dbUpdate('run_log', { id: runId }, {
    finished_at: new Date().toISOString(),
    status: summary.error ? 'failed' : 'completed',
    summary,
  });
}

// ── CONVENIENCE: get the supabase client directly for complex queries ─────────
function getClient() {
  return supabase;
}

module.exports = {
  supabase,
  getClient,
  dbRun,
  dbGet,
  dbAll,
  dbInsert,
  dbUpdate,
  initAndSeed,
  startRun,
  endRun,
};

// Run directly: node src/db.js
if (require.main === module) {
  initAndSeed().catch(console.error);
}