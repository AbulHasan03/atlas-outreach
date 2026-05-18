// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — DATABASE SETUP
// Uses sql.js — pure JavaScript SQLite, no compilation needed, works on any
// Node.js version. Database is loaded from / saved to db/outreach.db.
// ─────────────────────────────────────────────────────────────────────────────

const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, '../db/outreach.db');

// Ensure db directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ── LOAD OR CREATE DATABASE ───────────────────────────────────────────────────
// sql.js works in-memory; we load from file on open and save back on close.

async function getDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    return new SQL.Database(fileBuffer);
  }
  return new SQL.Database(); // new empty db
}

function saveDb(db) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── HELPERS: mimic better-sqlite3's synchronous API ──────────────────────────
// These wrappers let the rest of the code look almost identical to before.

function dbRun(db, sql, params = {}) {
  // sql.js uses positional $param style
  db.run(sql, namedToPositional(sql, params));
}

function dbGet(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(Array.isArray(params) ? params : [params]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

function dbAll(db, sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(Array.isArray(params) ? params : [params]);
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

// Convert @named params object to positional array matching $1,$2... or ?
function namedToPositional(sql, params) {
  if (Array.isArray(params)) return params;
  // sql.js supports $name style natively — pass object directly
  return params;
}

// ── INIT: create tables ───────────────────────────────────────────────────────

async function initDb() {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS prospects (
      id              TEXT PRIMARY KEY,
      company         TEXT NOT NULL,
      first_name      TEXT,
      last_name       TEXT,
      email           TEXT NOT NULL,
      title           TEXT,
      vertical        TEXT NOT NULL,
      prospect_type   TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active',
      notes           TEXT,
      added_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS emails (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id     TEXT NOT NULL,
      message_number  INTEGER NOT NULL,
      subject         TEXT NOT NULL,
      body            TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      sent_at         TEXT,
      scheduled_for   TEXT NOT NULL,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      prospect_id     TEXT NOT NULL,
      email_id        INTEGER,
      event_type      TEXT NOT NULL,
      occurred_at     TEXT NOT NULL DEFAULT (datetime('now')),
      metadata        TEXT,
      FOREIGN KEY (prospect_id) REFERENCES prospects(id),
      FOREIGN KEY (email_id) REFERENCES emails(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_emails_prospect    ON emails(prospect_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_emails_status      ON emails(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_emails_scheduled   ON emails(scheduled_for)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_prospect    ON events(prospect_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_type        ON events(event_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prospects_status   ON prospects(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prospects_vertical ON prospects(vertical)`);

  saveDb(db);
  db.close();
  console.log(`✅  Database ready at ${DB_PATH}`);
}

// ── SEED: sync prospects.js into the database ─────────────────────────────────

async function seedProspects() {
  const db = await getDb();
  const prospectList = require('../config/prospects');
  const now = new Date().toISOString();

  for (const p of prospectList) {
    const existing = dbGet(db, `SELECT id FROM prospects WHERE id = ?`, [p.id]);
    if (existing) {
      db.run(`
        UPDATE prospects SET
          company = ?, first_name = ?, last_name = ?, email = ?,
          title = ?, vertical = ?, prospect_type = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `, [p.company, p.first_name, p.last_name, p.email,
          p.title, p.vertical, p.prospect_type, p.notes || null, now, p.id]);
    } else {
      db.run(`
        INSERT INTO prospects
          (id, company, first_name, last_name, email, title, vertical, prospect_type, status, notes, added_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [p.id, p.company, p.first_name, p.last_name, p.email,
          p.title, p.vertical, p.prospect_type, p.status || 'active',
          p.notes || null, now, now]);
    }
  }

  const count = dbGet(db, `SELECT COUNT(*) as n FROM prospects`);
  saveDb(db);
  db.close();
  console.log(`✅  Synced ${count.n} prospects into database`);
}

async function initAndSeed() {
  const SQL = await initSqlJs();

  // Load existing db file if it exists, otherwise start fresh
  let db;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS prospects (
    id TEXT PRIMARY KEY, company TEXT NOT NULL, first_name TEXT, last_name TEXT,
    email TEXT NOT NULL, title TEXT, vertical TEXT NOT NULL, prospect_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', notes TEXT,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id TEXT NOT NULL,
    message_number INTEGER NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', sent_at TEXT, scheduled_for TEXT NOT NULL,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id TEXT NOT NULL, email_id INTEGER,
    event_type TEXT NOT NULL, occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
    metadata TEXT, FOREIGN KEY (prospect_id) REFERENCES prospects(id)
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_emails_prospect    ON emails(prospect_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_emails_status      ON emails(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_emails_scheduled   ON emails(scheduled_for)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_prospect    ON events(prospect_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_type        ON events(event_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prospects_status   ON prospects(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_prospects_vertical ON prospects(vertical)`);

  console.log(`✅  Database ready at ${DB_PATH}`);

  // Seed prospects
  const prospectList = require('../config/prospects');
  const now = new Date().toISOString();

  for (const p of prospectList) {
    const existing = dbGet(db, `SELECT id FROM prospects WHERE id = ?`, [p.id]);
    if (existing) {
      db.run(`UPDATE prospects SET company=?, first_name=?, last_name=?, email=?,
        title=?, vertical=?, prospect_type=?, notes=?, updated_at=? WHERE id=?`,
        [p.company, p.first_name, p.last_name, p.email,
         p.title, p.vertical, p.prospect_type, p.notes || null, now, p.id]);
    } else {
      db.run(`INSERT INTO prospects
        (id, company, first_name, last_name, email, title, vertical, prospect_type, status, notes, added_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.id, p.company, p.first_name, p.last_name, p.email,
         p.title, p.vertical, p.prospect_type, p.status || 'active',
         p.notes || null, now, now]);
    }
  }

  const count = dbGet(db, `SELECT COUNT(*) as n FROM prospects`);
  console.log(`✅  Synced ${count.n} prospects into database`);

  // Save everything in one shot
  saveDb(db);
  db.close();
}

module.exports = { getDb, saveDb, initDb, seedProspects, initAndSeed, dbRun, dbGet, dbAll };

// Run directly: node src/db.js
if (require.main === module) {
  initAndSeed().catch(console.error);
}