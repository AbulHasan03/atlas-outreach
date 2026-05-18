// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

const { getDb, saveDb, dbGet, dbAll } = require('./db');
const { generateEmail } = require('./generate');
const cadence = require('../config/cadence');

async function scheduleTodaysEmails(options = {}) {
  const { dryRun = false, vertical = null } = options;
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];

  console.log(`\n📅  Scheduling emails for ${today}${dryRun ? ' (DRY RUN)' : ''}...\n`);

  const activeProspects = vertical
    ? dbAll(db, `SELECT * FROM prospects WHERE status = 'active' AND vertical = ?`, [vertical])
    : dbAll(db, `SELECT * FROM prospects WHERE status = 'active'`);

  console.log(`  Found ${activeProspects.length} active prospect(s)${vertical ? ` in vertical: ${vertical}` : ''}`);

  const toQueue = [];
  for (const prospect of activeProspects) {
    const nextMessage = getNextMessage(db, prospect);
    if (!nextMessage) continue;
    const { messageNumber, scheduledDate } = nextMessage;
    if (scheduledDate > today) continue;
    toQueue.push({ prospect, messageNumber, scheduledDate: today });
  }

  const maxSends = process.env.MAX_SENDS ? parseInt(process.env.MAX_SENDS) : null;
  if (maxSends && toQueue.length > maxSends) {
    console.log(`  ⚠️  MAX_SENDS=${maxSends} — capping run to ${maxSends} of ${toQueue.length} due email(s)`);
    toQueue.splice(maxSends);
  }

  console.log(`  ${toQueue.length} email(s) to send today\n`);

  if (dryRun) {
    for (const item of toQueue) {
      console.log(`  [DRY RUN] Would send Message ${item.messageNumber} to ${item.prospect.company} (${item.prospect.email})`);
    }
    db.close();
    return [];
  }

  const queued = [];
  let skipped = 0;
  for (const item of toQueue) {
    try {
      const { subject, body } = await generateEmail(item.prospect, item.messageNumber);
      db.run(`INSERT INTO emails (prospect_id, message_number, subject, body, status, scheduled_for) VALUES (?, ?, ?, ?, 'pending', ?)`,
        [item.prospect.id, item.messageNumber, subject, body, item.scheduledDate]);
      const row = dbGet(db, `SELECT last_insert_rowid() as id`);
      queued.push({ emailId: row.id, prospect: item.prospect, messageNumber: item.messageNumber, subject, body });
      console.log(`  ✅  Queued: ${item.prospect.company} — Message ${item.messageNumber}`);
    } catch (err) {
      if (isQuotaError(err)) {
        skipped = toQueue.length - queued.length;
        console.warn(`\n  ⚠️  Gemini quota hit — ${queued.length} email(s) queued, ${skipped} skipped.`);
        console.warn(`  ↩️  They will be picked up automatically on the next run.\n`);
        break;
      }
      console.error(`  ❌  Failed for ${item.prospect.company}: ${err.message}`);
    }
  }

  saveDb(db);
  db.close();
  console.log(`\n  ${queued.length} email(s) queued and ready to send.`);
  return queued;
}

function getNextMessage(db, prospect) {
  const sentEmails = dbAll(db,
    `SELECT message_number, sent_at FROM emails WHERE prospect_id = ? AND status = 'sent' ORDER BY message_number ASC`,
    [prospect.id]);
  const sentNumbers = sentEmails.map(e => e.message_number);

  for (const step of cadence) {
    if (sentNumbers.includes(step.message_number)) continue;
    if (step.message_number === 1) {
      return { messageNumber: 1, scheduledDate: prospect.added_at.split('T')[0] };
    }
    const message1 = sentEmails.find(e => e.message_number === 1);
    if (!message1) return null;
    const baseDate = new Date(message1.sent_at);
    baseDate.setDate(baseDate.getDate() + step.send_on_day);
    return { messageNumber: step.message_number, scheduledDate: baseDate.toISOString().split('T')[0] };
  }
  return null;
}

async function previewSchedule(options = {}) {
  const { vertical = null } = options;
  const db = await getDb();
  const today = new Date().toISOString().split('T')[0];
  const activeProspects = vertical
    ? dbAll(db, `SELECT * FROM prospects WHERE status = 'active' AND vertical = ?`, [vertical])
    : dbAll(db, `SELECT * FROM prospects WHERE status = 'active'`);

  console.log(`\n📅  Schedule preview for ${today}\n`);
  console.log('  ' + '─'.repeat(70));
  let dueCount = 0;
  for (const prospect of activeProspects) {
    const next = getNextMessage(db, prospect);
    if (!next) continue;
    const status = next.scheduledDate <= today ? '🔴 DUE' : `⏳  ${next.scheduledDate}`;
    if (next.scheduledDate <= today) dueCount++;
    console.log(`  ${status}  Msg ${next.messageNumber}  ${prospect.company.padEnd(30)} ${prospect.vertical}`);
  }
  console.log('  ' + '─'.repeat(70));
  console.log(`  ${dueCount} email(s) due today\n`);
  db.close();
}

function isQuotaError(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted') || err.status === 429;
}

module.exports = { scheduleTodaysEmails, previewSchedule };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verticalArg = args.find(a => a.startsWith('--vertical='));
  const vertical = verticalArg ? verticalArg.split('=')[1] : null;
  if (args.includes('--preview')) {
    previewSchedule({ vertical }).catch(console.error);
  } else {
    scheduleTodaysEmails({ dryRun, vertical }).catch(console.error);
  }
}