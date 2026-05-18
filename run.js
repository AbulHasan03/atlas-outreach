#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — MAIN ENTRY POINT
//
// USAGE:
//   node run.js                      → full daily run (schedule + send)
//   node run.js --dry-run            → preview what would send, no emails sent
//   node run.js --preview            → show schedule without generating emails
//   node run.js --report             → print performance report
//   node run.js --export             → export CSV for CRM
//   node run.js --preview-email <id> → preview a generated email for a prospect
//   node run.js --vertical=gym       → only process a single vertical
//   node run.js --replied <id>       → mark a prospect as replied (pauses cadence)
//   node run.js --opted-out <id>     → mark a prospect as opted out
//   node run.js --setup              → first-time setup: create DB + seed prospects
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { initDb, seedProspects, initAndSeed } = require('./src/db');
const { scheduleTodaysEmails, previewSchedule } = require('./src/scheduler');
const { sendPendingEmails, markReplied, markOptedOut } = require('./src/sender');
const { report, exportCsv } = require('./src/reporter');
const { startServer } = require('./src/server');
const { previewEmail } = require('./src/generate');

const args = process.argv.slice(2);

function hasFlag(flag) { return args.includes(flag); }
function getFlag(prefix) {
  const f = args.find(a => a.startsWith(prefix + '='));
  return f ? f.split('=').slice(1).join('=') : null;
}
function getPositional(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

// ── UI MODE — must be before main() ───────────────────────────────────────────
if (process.argv.includes('--ui')) {
  startServer(3000).then(async (port) => {
    try {
      const open = require('open');
      await open(`http://localhost:${port}`);
    } catch {
      console.log(`  Open your browser to: http://localhost:${port}`);
    }
  }).catch(console.error);
  // intentionally no return — server stays alive
} else {
  main().catch(err => {
    console.error('\n❌  Unexpected error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
}

async function main() {

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (hasFlag('--setup')) {
    console.log('\n🔧  First-time setup...\n');
    await initAndSeed();
    console.log('\n✅  Setup complete. Run `node run.js --preview` to see your schedule.\n');
    return;
  }

  // ── STATUS UPDATES ─────────────────────────────────────────────────────────
  if (hasFlag('--replied')) {
    const id = getPositional('--replied');
    if (!id) { console.error('Usage: node run.js --replied <prospect_id>'); process.exit(1); }
    markReplied(id);
    return;
  }

  if (hasFlag('--opted-out')) {
    const id = getPositional('--opted-out');
    if (!id) { console.error('Usage: node run.js --opted-out <prospect_id>'); process.exit(1); }
    markOptedOut(id);
    return;
  }

  // ── REPORTING ──────────────────────────────────────────────────────────────
  if (hasFlag('--report')) {
    report();
    return;
  }

  if (hasFlag('--export')) {
    exportCsv();
    return;
  }

  // ── EMAIL PREVIEW ──────────────────────────────────────────────────────────
  if (hasFlag('--preview-email')) {
    const id = getPositional('--preview-email');
    const msgNum = getFlag('--message') || '1';
    if (!id) { console.error('Usage: node run.js --preview-email <prospect_id> [--message=2]'); process.exit(1); }
    await previewEmail(id, parseInt(msgNum));
    return;
  }

  // ── SCHEDULE PREVIEW (no generation, no sending) ───────────────────────────
  if (hasFlag('--preview')) {
    const vertical = getFlag('--vertical');
    previewSchedule({ vertical });
    return;
  }

  // ── DAILY RUN ──────────────────────────────────────────────────────────────
  const dryRun   = hasFlag('--dry-run');
  const vertical = getFlag('--vertical');

  checkEnv(dryRun);

  console.log('\n🚀  Atlas Outreach — Daily Run');
  if (dryRun)   console.log('   Mode: DRY RUN (no emails will be sent)');
  if (vertical) console.log(`   Vertical filter: ${vertical}`);

  // Step 1: Generate and queue today's emails
  await scheduleTodaysEmails({ dryRun, vertical });

  // Step 2: Send all pending emails
  if (!dryRun) {
    await sendPendingEmails({ dryRun });
  }

  // Step 3: Print a quick summary
  report();
}


function checkEnv(dryRun) {
  const missing = [];
  if (!process.env.GEMINI_API_KEY)   missing.push('GEMINI_API_KEY');
  if (!dryRun && !process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
  if (!dryRun && !process.env.SENDER_FROM)    missing.push('SENDER_FROM');

  if (missing.length > 0) {
    console.error('\n❌  Missing required environment variables:');
    missing.forEach(k => console.error(`   ${k}`));
    console.error('\n   Add them to your .env file. See .env.example for reference.\n');
    process.exit(1);
  }
}