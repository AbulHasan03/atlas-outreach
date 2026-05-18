// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — LOGGER
// Writes timestamped logs to both console and logs/outreach.log
// Also writes structured JSON to logs/outreach.jsonl for parsing
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'outreach.log');
const JSON_LOG = path.join(LOG_DIR, 'outreach.jsonl');

fs.mkdirSync(LOG_DIR, { recursive: true });

const LEVELS = { info: '→', success: '✓', warn: '⚠', error: '✗', debug: '·' };
const COLORS = {
  info:    '\x1b[36m',  // cyan
  success: '\x1b[32m',  // green
  warn:    '\x1b[33m',  // yellow
  error:   '\x1b[31m',  // red
  debug:   '\x1b[90m',  // gray
  reset:   '\x1b[0m',
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function write(level, message, meta = {}) {
  const ts     = timestamp();
  const icon   = LEVELS[level] || '·';
  const color  = COLORS[level] || '';
  const reset  = COLORS.reset;

  // Console output with color
  const metaStr = Object.keys(meta).length ? '  ' + JSON.stringify(meta) : '';
  console.log(`${color}${icon}${reset} [${ts}] ${message}${COLORS.debug}${metaStr}${reset}`);

  // Plain text log file
  const logLine = `[${ts}] [${level.toUpperCase().padEnd(7)}] ${message}${metaStr}\n`;
  fs.appendFileSync(LOG_FILE, logLine);

  // Structured JSON log
  const jsonLine = JSON.stringify({ ts, level, message, ...meta }) + '\n';
  fs.appendFileSync(JSON_LOG, jsonLine);
}

const logger = {
  info:    (msg, meta) => write('info',    msg, meta),
  success: (msg, meta) => write('success', msg, meta),
  warn:    (msg, meta) => write('warn',    msg, meta),
  error:   (msg, meta) => write('error',   msg, meta),
  debug:   (msg, meta) => write('debug',   msg, meta),

  // Log a run session start/end to DB
  async startRun(db, mode) {
    const now = new Date().toISOString();
    db.run(`INSERT INTO run_log (started_at, mode, status) VALUES (?, ?, 'running')`, [now, mode]);
    const row = db.prepare ? db.prepare('SELECT last_insert_rowid() as id').get()
      : (() => { const { dbGet } = require('./db'); return dbGet(db, 'SELECT last_insert_rowid() as id'); })();
    this.info(`Run started`, { mode, run_id: row?.id });
    return row?.id;
  },

  async endRun(db, runId, summary = {}) {
    const now = new Date().toISOString();
    db.run(`UPDATE run_log SET finished_at=?, status=?, summary=? WHERE id=?`,
      [now, summary.error ? 'failed' : 'completed', JSON.stringify(summary), runId]);
    if (summary.error) {
      this.error(`Run failed`, { run_id: runId, ...summary });
    } else {
      this.success(`Run completed`, { run_id: runId, ...summary });
    }
  },

  // Tail the log file — returns last N lines
  tail(n = 50) {
    if (!fs.existsSync(LOG_FILE)) return [];
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n');
    return lines.slice(-n);
  },

  // Return recent structured log entries
  recent(n = 100) {
    if (!fs.existsSync(JSON_LOG)) return [];
    const lines = fs.readFileSync(JSON_LOG, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  },
};

module.exports = logger;