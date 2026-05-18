// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — SENDER
// Reads draft emails whose scheduled_for date is today or past,
// sends them via Resend, and marks them as sent.
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { Resend } = require('resend');
const { getClient } = require('./db');
const logger = require('./logger');

const SENDER_NAME   = process.env.SENDER_NAME  || 'Your Name';
const SENDER_EMAIL  = process.env.SENDER_FROM  || 'you@yourdomain.com';
const REPLY_TO      = process.env.REPLY_TO     || SENDER_EMAIL;
const TEST_OVERRIDE = process.env.TEST_EMAIL_OVERRIDE;

async function sendPendingEmails(options = {}) {
  const { dryRun = false } = options;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const sb     = getClient();
  const today  = new Date().toISOString().split('T')[0];

  // Fetch all drafts due today or overdue, joined with prospect info
  const { data: drafts, error } = await sb
    .from('emails')
    .select('*, prospects(id, email, first_name, last_name, company, vertical, status)')
    .eq('status', 'draft')
    .lte('scheduled_for', today)
    .order('scheduled_for', { ascending: true });

  if (error) throw new Error(`Failed to fetch drafts: ${error.message}`);

  // Skip prospects who are no longer active
  const pending = (drafts || []).filter(e => e.prospects?.status === 'active');

  if (!pending.length) {
    logger.info('No drafts due to send today');
    return;
  }

  logger.info(`Sending ${pending.length} email(s)`);

  for (const email of pending) {
    const prospect = email.prospects;
    try {
      if (dryRun) {
        logger.debug(`[DRY RUN] Would send to ${prospect.company}`, { email: prospect.email, msg: email.message_number });
        continue;
      }

      const toName    = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ');
      const toAddress = TEST_OVERRIDE ? `${toName} <${TEST_OVERRIDE}>` : `${toName} <${prospect.email}>`;

      if (TEST_OVERRIDE) logger.info(`TEST MODE — redirecting to ${TEST_OVERRIDE}`, { original: prospect.email });

      await resend.emails.send({
        from:     `${SENDER_NAME} <${SENDER_EMAIL}>`,
        to:       toAddress,
        reply_to: REPLY_TO,
        subject:  email.subject,
        text:     email.body,
        headers:  { 'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>` },
      });

      const now = new Date().toISOString();
      await sb.from('emails').update({ status: 'sent', sent_at: now }).eq('id', email.id);
      await sb.from('events').insert({
        prospect_id: prospect.id,
        email_id:    email.id,
        event_type:  'sent',
        occurred_at: now,
      });

      logger.success(`Sent to ${prospect.company}`, { email: prospect.email, message_number: email.message_number });
      await sleep(1500);

    } catch (err) {
      await sb.from('emails').update({ status: 'failed' }).eq('id', email.id);
      await sb.from('events').insert({
        prospect_id: prospect.id,
        email_id:    email.id,
        event_type:  'failed',
        metadata:    { error: err.message },
      });
      logger.error(`Send failed for ${prospect.company}`, { error: err.message });
    }
  }

  logger.info('Done sending');
}

async function markReplied(prospectId) {
  const sb  = getClient();
  const now = new Date().toISOString();
  await sb.from('prospects').update({ status: 'replied', updated_at: now }).eq('id', prospectId);
  await sb.from('events').insert({ prospect_id: prospectId, event_type: 'replied', metadata: { note: 'Marked manually' } });
  logger.success(`Marked ${prospectId} as replied — cadence paused`);
}

async function markOptedOut(prospectId) {
  const sb  = getClient();
  const now = new Date().toISOString();
  await sb.from('prospects').update({ status: 'opted_out', updated_at: now }).eq('id', prospectId);
  await sb.from('events').insert({ prospect_id: prospectId, event_type: 'opted_out' });
  logger.success(`Marked ${prospectId} as opted out`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { sendPendingEmails, markReplied, markOptedOut };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  sendPendingEmails({ dryRun }).catch(console.error);
}