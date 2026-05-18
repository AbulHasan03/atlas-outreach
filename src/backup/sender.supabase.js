// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — SENDER (Supabase version)
// Matches sender.sqlite.js: TEST_EMAIL_OVERRIDE support
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { Resend } = require('resend');
const { getClient, dbUpdate, dbInsert, dbGet } = require('./db');

async function sendPendingEmails(options = {}) {
  const { dryRun = false } = options;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const SENDER_NAME  = process.env.SENDER_NAME  || 'Your Name';
  const SENDER_EMAIL = process.env.SENDER_FROM  || 'you@yourdomain.com';
  const REPLY_TO     = process.env.REPLY_TO     || SENDER_EMAIL;
  const TEST_OVERRIDE = process.env.TEST_EMAIL_OVERRIDE;
  const sb = getClient();

  const { data: pending, error } = await sb.from('emails')
    .select('*, prospects(email, first_name, last_name, company, vertical)')
    .eq('status', 'pending').order('scheduled_for', { ascending: true });

  if (error) throw new Error(`Failed to fetch pending emails: ${error.message}`);
  if (!pending?.length) { console.log('  📭  No pending emails to send.'); return; }

  console.log(`\n📤  Sending ${pending.length} email(s)...\n`);

  for (const email of pending) {
    const prospect = email.prospects;
    try {
      if (dryRun) {
        console.log(`  [DRY RUN] Would send to ${prospect.company} (${prospect.email}) — Msg ${email.message_number}`);
        continue;
      }
      const toName = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ');
      const toAddress = TEST_OVERRIDE ? `${toName} <${TEST_OVERRIDE}>` : `${toName} <${prospect.email}>`;
      if (TEST_OVERRIDE) console.log(`  [TEST MODE] Redirecting to ${TEST_OVERRIDE}`);

      await resend.emails.send({
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`, to: toAddress, reply_to: REPLY_TO,
        subject: email.subject, text: email.body,
        headers: { 'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>` },
      });

      const now = new Date().toISOString();
      await dbUpdate('emails', { id: email.id }, { status: 'sent', sent_at: now });
      await dbInsert('events', { prospect_id: email.prospect_id, email_id: email.id, event_type: 'sent', occurred_at: now });
      console.log(`  ✅  Sent to ${prospect.company} (${prospect.email}) — Msg ${email.message_number}`);
      await sleep(1500);
    } catch (err) {
      await dbUpdate('emails', { id: email.id }, { status: 'failed' });
      await dbInsert('events', { prospect_id: email.prospect_id, email_id: email.id, event_type: 'failed', metadata: { error: err.message } });
      console.error(`  ❌  Failed: ${prospect.company} — ${err.message}`);
    }
  }
  console.log('\n  Done sending.\n');
}

async function markReplied(prospectId) {
  await dbUpdate('prospects', { id: prospectId }, { status: 'replied' });
  await dbInsert('events', { prospect_id: prospectId, event_type: 'replied', metadata: { note: 'Marked manually' } });
  console.log(`✅  Marked ${prospectId} as replied — cadence paused.`);
}

async function markOptedOut(prospectId) {
  await dbUpdate('prospects', { id: prospectId }, { status: 'opted_out' });
  await dbInsert('events', { prospect_id: prospectId, event_type: 'opted_out' });
  console.log(`🚫  Marked ${prospectId} as opted out.`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
module.exports = { sendPendingEmails, markReplied, markOptedOut };