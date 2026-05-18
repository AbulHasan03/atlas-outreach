// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — SCHEDULER (Supabase version)
// Matches scheduler.sqlite.js: MAX_SENDS cap + quota error handling
// ─────────────────────────────────────────────────────────────────────────────

const { dbAll, dbInsert, getClient } = require('./db');
const { generateEmail } = require('./generate');
const cadence = require('../config/cadence');

async function scheduleTodaysEmails(options = {}) {
  const { dryRun = false, vertical = null } = options;
  const today = new Date().toISOString().split('T')[0];

  console.log(`\n📅  Scheduling emails for ${today}${dryRun ? ' (DRY RUN)' : ''}...\n`);

  const filters = { status: 'active' };
  if (vertical) filters.vertical = vertical;
  const activeProspects = await dbAll('prospects', filters);

  console.log(`  Found ${activeProspects.length} active prospect(s)${vertical ? ` in vertical: ${vertical}` : ''}`);

  const toQueue = [];
  for (const prospect of activeProspects) {
    const nextMessage = await getNextMessage(prospect);
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
    return [];
  }

  const queued = [];
  for (const item of toQueue) {
    try {
      const { subject, body } = await generateEmail(item.prospect, item.messageNumber);
      const row = await dbInsert('emails', {
        prospect_id: item.prospect.id, message_number: item.messageNumber,
        subject, body, status: 'pending', scheduled_for: item.scheduledDate,
      });
      queued.push({ emailId: row.id, prospect: item.prospect, messageNumber: item.messageNumber, subject, body });
      console.log(`  ✅  Queued: ${item.prospect.company} — Message ${item.messageNumber}`);
    } catch (err) {
      if (isQuotaError(err)) {
        console.warn(`\n  ⚠️  Quota hit — ${queued.length} queued, ${toQueue.length - queued.length} skipped.\n`);
        break;
      }
      console.error(`  ❌  Failed for ${item.prospect.company}: ${err.message}`);
    }
  }

  console.log(`\n  ${queued.length} email(s) queued and ready to send.`);
  return queued;
}

async function getNextMessage(prospect) {
  const sb = getClient();
  const { data: sentEmails } = await sb.from('emails').select('message_number, sent_at')
    .eq('prospect_id', prospect.id).eq('status', 'sent').order('message_number', { ascending: true });
  const sentNumbers = (sentEmails || []).map(e => e.message_number);

  for (const step of cadence) {
    if (sentNumbers.includes(step.message_number)) continue;
    if (step.message_number === 1) return { messageNumber: 1, scheduledDate: prospect.added_at.split('T')[0] };
    const msg1 = (sentEmails || []).find(e => e.message_number === 1);
    if (!msg1) return null;
    const base = new Date(msg1.sent_at);
    base.setDate(base.getDate() + step.send_on_day);
    return { messageNumber: step.message_number, scheduledDate: base.toISOString().split('T')[0] };
  }
  return null;
}

async function previewSchedule(options = {}) {
  const { vertical = null } = options;
  const today = new Date().toISOString().split('T')[0];
  const filters = { status: 'active' };
  if (vertical) filters.vertical = vertical;
  const activeProspects = await dbAll('prospects', filters);

  console.log(`\n📅  Schedule preview for ${today}\n`);
  console.log('  ' + '─'.repeat(70));
  let dueCount = 0;
  for (const prospect of activeProspects) {
    const next = await getNextMessage(prospect);
    if (!next) continue;
    const status = next.scheduledDate <= today ? '🔴 DUE' : `⏳  ${next.scheduledDate}`;
    if (next.scheduledDate <= today) dueCount++;
    console.log(`  ${status}  Msg ${next.messageNumber}  ${prospect.company.padEnd(30)} ${prospect.vertical}`);
  }
  console.log('  ' + '─'.repeat(70));
  console.log(`  ${dueCount} email(s) due today\n`);
}

function isQuotaError(err) {
  const msg = (err.message || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted') || err.status === 429;
}

module.exports = { scheduleTodaysEmails, previewSchedule };