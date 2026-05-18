// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — DATABASE (Supabase)
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function dbRun(sql, params = []) {
  const { error } = await supabase.rpc('exec_sql', { sql, params });
  if (error) throw new Error(`dbRun error: ${error.message}\nSQL: ${sql}`);
}

async function dbGet(table, filters = {}, columns = '*') {
  let query = supabase.from(table).select(columns);
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  const { data, error } = await query.limit(1).single();
  if (error && error.code !== 'PGRST116') throw new Error(`dbGet error: ${error.message}`);
  return data || undefined;
}

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

async function dbInsert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw new Error(`dbInsert error: ${error.message}\nTable: ${table}`);
  return data;
}

async function dbUpdate(table, filters, updates) {
  let query = supabase.from(table).update(updates);
  for (const [col, val] of Object.entries(filters)) {
    query = query.eq(col, val);
  }
  const { error } = await query;
  if (error) throw new Error(`dbUpdate error: ${error.message}`);
}

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
  startRun,
  endRun,
};