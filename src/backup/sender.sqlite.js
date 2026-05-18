// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — EMAIL SENDER
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { Resend } = require('resend');
const { getDb, saveDb, dbAll, dbGet } = require('./db');

async function sendPendingEmails(options = {}) {
  const { dryRun = false } = options;
  const db = await getDb();

  const pending = dbAll(db, `
    SELECT e.*, p.email, p.first_name, p.last_name, p.company, p.vertical
    FROM emails e
    JOIN prospects p ON e.prospect_id = p.id
    WHERE e.status = 'pending'
    ORDER BY e.scheduled_for ASC
  `);

  if (pending.length === 0) {
    console.log('  📭  No pending emails to send.');
    db.close();
    return;
  }

  console.log(`\n📤  Sending ${pending.length} email(s)...\n`);

  for (const email of pending) {
    try {
      if (dryRun) {
        console.log(`  [DRY RUN] Would send to ${email.email} — ${email.subject}`);
        continue;
      }
      await sendEmail(email);
      markSent(db, email.id, email.prospect_id);
      console.log(`  ✅  Sent to ${email.company} (${email.email}) — Msg ${email.message_number}`);
      await sleep(1500);
    } catch (err) {
      markFailed(db, email.id, email.prospect_id, err.message);
      console.error(`  ❌  Failed: ${email.company} — ${err.message}`);
    }
  }

  saveDb(db);
  db.close();
  console.log('\n  Done sending.\n');
}

async function sendEmail(emailRecord) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const SENDER_NAME  = process.env.SENDER_NAME  || 'Your Name';
  const SENDER_EMAIL = process.env.SENDER_FROM  || 'you@yourdomain.com';
  const REPLY_TO     = process.env.REPLY_TO     || SENDER_EMAIL;
  const TEST_OVERRIDE = process.env.TEST_EMAIL_OVERRIDE;
  const toName = [emailRecord.first_name, emailRecord.last_name].filter(Boolean).join(' ');
  const toAddress = TEST_OVERRIDE
    ? `${toName} <${TEST_OVERRIDE}>`
    : `${toName} <${emailRecord.email}>`;
  if (TEST_OVERRIDE) {
    console.log(`  [TEST MODE] Redirecting to ${TEST_OVERRIDE} (prospect: ${emailRecord.email})`);
  }
  await resend.emails.send({
    from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
    to: toAddress,
    reply_to: REPLY_TO,
    subject: emailRecord.subject,
    text: emailRecord.body,
    headers: { 'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>` },
  });
}

function markSent(db, emailId, prospectId) {
  const now = new Date().toISOString();
  db.run(`UPDATE emails SET status = 'sent', sent_at = ? WHERE id = ?`, [now, emailId]);
  db.run(`INSERT INTO events (prospect_id, email_id, event_type, occurred_at) VALUES (?, ?, 'sent', ?)`, [prospectId, emailId, now]);
}

function markFailed(db, emailId, prospectId, errorMessage) {
  db.run(`UPDATE emails SET status = 'failed' WHERE id = ?`, [emailId]);
  db.run(`INSERT INTO events (prospect_id, email_id, event_type, metadata) VALUES (?, ?, 'failed', ?)`,
    [prospectId, emailId, JSON.stringify({ error: errorMessage })]);
}

async function markReplied(prospectId) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(`UPDATE prospects SET status = 'replied', updated_at = ? WHERE id = ?`, [now, prospectId]);
  db.run(`INSERT INTO events (prospect_id, event_type, metadata) VALUES (?, 'replied', ?)`,
    [prospectId, JSON.stringify({ note: 'Marked manually' })]);
  const prospect = dbGet(db, `SELECT company FROM prospects WHERE id = ?`, [prospectId]);
  saveDb(db);
  db.close();
  console.log(`✅  Marked ${prospect?.company || prospectId} as replied — cadence paused.`);
}

async function markOptedOut(prospectId) {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(`UPDATE prospects SET status = 'opted_out', updated_at = ? WHERE id = ?`, [now, prospectId]);
  db.run(`INSERT INTO events (prospect_id, event_type) VALUES (?, 'opted_out')`, [prospectId]);
  const prospect = dbGet(db, `SELECT company FROM prospects WHERE id = ?`, [prospectId]);
  saveDb(db);
  db.close();
  console.log(`🚫  Marked ${prospect?.company || prospectId} as opted out.`);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

module.exports = { sendPendingEmails, markReplied, markOptedOut };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  sendPendingEmails({ dryRun }).catch(console.error);
}