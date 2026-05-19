// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — SCHEDULER
// Unified draft-based flow:
//   - Check if a draft already exists for this prospect/message
//   - If yes → queue the existing draft (human may have edited it)
//   - If no  → generate a new one and save as draft
//   - sender.js reads drafts due today and sends them
// ─────────────────────────────────────────────────────────────────────────────

const { getClient } = require('./db');
const { generateEmail } = require('./generate');
const logger  = require('./logger');

const fs           = require('fs');
const path         = require('path');
const defaultCadence = require('../config/cadence');

function loadCadence() {
  const overridePath = path.join(__dirname, '../data/cadence_override.json');
  try {
    if (fs.existsSync(overridePath)) {
      const override = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
      return defaultCadence.map(step => ({
        ...step,
        send_on_day: override[step.message_number] ?? step.send_on_day,
      }));
    }
  } catch {}
  return defaultCadence;
}

const cadence = loadCadence();

async function scheduleTodaysEmails(options = {}) {
  const { dryRun = false, vertical = null } = options;
  const sb    = getClient();
  const today = new Date().toISOString().split('T')[0];

  logger.info(`Scheduling emails for ${today}${dryRun ? ' (DRY RUN)' : ''}`);

  let query = sb.from('prospects').select('*').eq('status', 'active');
  if (vertical) query = query.eq('vertical', vertical);
  const { data: activeProspects } = await query;

  logger.info(`Found ${(activeProspects || []).length} active prospect(s)${vertical ? ` in vertical: ${vertical}` : ''}`);

  const toQueue = [];
  for (const prospect of activeProspects || []) {
    const nextMessage = await getNextMessage(prospect);
    if (!nextMessage) continue;
    const { messageNumber, scheduledDate } = nextMessage;
    if (scheduledDate > today) continue;
    toQueue.push({ prospect, messageNumber, scheduledDate: today });
  }

  const maxSends = process.env.MAX_SENDS ? parseInt(process.env.MAX_SENDS) : null;
  if (maxSends && toQueue.length > maxSends) {
    logger.warn(`MAX_SENDS=${maxSends} — capping run to ${maxSends} of ${toQueue.length} due email(s)`);
    toQueue.splice(maxSends);
  }

  logger.info(`${toQueue.length} email(s) to process today`);

  if (dryRun) {
    for (const item of toQueue) {
      // Check if draft exists
      const { data: existing } = await sb.from('emails')
        .select('id, subject')
        .eq('prospect_id', item.prospect.id)
        .eq('message_number', item.messageNumber)
        .eq('status', 'draft')
        .single();
      const source = existing ? 'existing draft' : 'would generate new';
      logger.debug(`[DRY RUN] ${item.prospect.company} Msg ${item.messageNumber} — ${source}`, { email: item.prospect.email });
    }
    return [];
  }

  const queued = [];
  for (const item of toQueue) {
    try {
      // Check if a draft already exists (human may have generated/edited via UI)
      const { data: existingDraft } = await sb.from('emails')
        .select('id, subject, body')
        .eq('prospect_id', item.prospect.id)
        .eq('message_number', item.messageNumber)
        .eq('status', 'draft')
        .single();

      if (existingDraft) {
        // Use the existing draft — don't regenerate
        logger.info(`Using existing draft for ${item.prospect.company} Msg ${item.messageNumber}`);
        queued.push({
          emailId:       existingDraft.id,
          prospect:      item.prospect,
          messageNumber: item.messageNumber,
          subject:       existingDraft.subject,
          body:          existingDraft.body,
        });
      } else {
        // No draft exists — generate and save as draft
        const { subject, body } = await generateEmail(item.prospect, item.messageNumber);

        // 15s delay to stay under Gemini 5 RPM free tier limit
        await new Promise(r => setTimeout(r, 15000));

        const { data: row } = await sb.from('emails').insert({
          prospect_id:    item.prospect.id,
          message_number: item.messageNumber,
          subject,
          body,
          status:         'draft',
          scheduled_for:  item.scheduledDate,
        }).select().single();

        queued.push({ emailId: row.id, prospect: item.prospect, messageNumber: item.messageNumber, subject, body });
        logger.success(`Generated + saved draft: ${item.prospect.company} — Message ${item.messageNumber}`);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        logger.warn(`Quota hit — ${queued.length} processed, ${toQueue.length - queued.length} skipped. Will retry next run.`);
        break;
      }
      logger.error(`Failed for ${item.prospect.company}`, { error: err.message });
    }
  }

  logger.info(`${queued.length} email(s) ready to send`);
  return queued;
}

async function getNextMessage(prospect) {
  const sb = getClient();
  const { data: sentEmails } = await sb.from('emails')
    .select('message_number, sent_at')
    .eq('prospect_id', prospect.id)
    .eq('status', 'sent')
    .order('message_number', { ascending: true });

  const sentNumbers = (sentEmails || []).map(e => e.message_number);

  for (const step of cadence) {
    if (sentNumbers.includes(step.message_number)) continue;
    if (step.message_number === 1) {
      return { messageNumber: 1, scheduledDate: prospect.added_at.split('T')[0] };
    }
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
  const sb    = getClient();
  const today = new Date().toISOString().split('T')[0];

  let query = sb.from('prospects').select('*').eq('status', 'active');
  if (vertical) query = query.eq('vertical', vertical);
  const { data: activeProspects } = await query;

  console.log(`\n📅  Schedule preview for ${today}\n`);
  console.log('  ' + '─'.repeat(80));

  let dueCount = 0;
  for (const prospect of activeProspects || []) {
    const next = await getNextMessage(prospect);
    if (!next) continue;

    // Check if draft exists
    const { data: draft } = await sb.from('emails')
      .select('id')
      .eq('prospect_id', prospect.id)
      .eq('message_number', next.messageNumber)
      .eq('status', 'draft')
      .single();

    const isDue      = next.scheduledDate <= today;
    const draftLabel = draft ? ' [draft ready]' : '';
    const status     = isDue ? '🔴 DUE' : `⏳  ${next.scheduledDate}`;
    if (isDue) dueCount++;

    console.log(`  ${status}  Msg ${next.messageNumber}  ${prospect.company.padEnd(30)} ${prospect.vertical}${draftLabel}`);
  }

  console.log('  ' + '─'.repeat(80));
  console.log(`  ${dueCount} email(s) due today\n`);
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