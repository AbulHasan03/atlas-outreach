// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — REPORTER
// ─────────────────────────────────────────────────────────────────────────────

const { getDb, dbGet, dbAll } = require('./db');
const fs   = require('fs');
const path = require('path');

async function report() {
  const db = await getDb();

  console.log('\n' + '═'.repeat(65));
  console.log('  ATLAS OUTREACH — REPORT');
  console.log('  ' + new Date().toLocaleString());
  console.log('═'.repeat(65));

  const totals = dbGet(db, `
    SELECT
      COUNT(*) AS total_prospects,
      SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status = 'replied'   THEN 1 ELSE 0 END) AS replied,
      SUM(CASE WHEN status = 'opted_out' THEN 1 ELSE 0 END) AS opted_out,
      SUM(CASE WHEN status = 'won'       THEN 1 ELSE 0 END) AS won
    FROM prospects
  `);

  const emailTotals = dbGet(db, `
    SELECT
      COUNT(*) AS total_sent,
      SUM(CASE WHEN message_number = 1 THEN 1 END) AS msg1,
      SUM(CASE WHEN message_number = 2 THEN 1 END) AS msg2,
      SUM(CASE WHEN message_number = 3 THEN 1 END) AS msg3,
      SUM(CASE WHEN message_number = 4 THEN 1 END) AS msg4
    FROM emails WHERE status = 'sent'
  `);

  const replyCount = dbGet(db, `SELECT COUNT(*) AS n FROM events WHERE event_type = 'replied'`).n;
  const replyRate  = emailTotals.msg1 > 0 ? ((replyCount / emailTotals.msg1) * 100).toFixed(1) : '0.0';

  console.log('\n  OVERALL');
  console.log('  ' + '─'.repeat(40));
  console.log(`  Total prospects  : ${totals.total_prospects}`);
  console.log(`  Active in cadence: ${totals.active}`);
  console.log(`  Replied (manual) : ${totals.replied}`);
  console.log(`  Won              : ${totals.won}`);
  console.log(`  Opted out        : ${totals.opted_out}`);
  console.log('');
  console.log(`  Emails sent      : ${emailTotals.total_sent}`);
  console.log(`    Message 1      : ${emailTotals.msg1 || 0}`);
  console.log(`    Message 2      : ${emailTotals.msg2 || 0}`);
  console.log(`    Message 3      : ${emailTotals.msg3 || 0}`);
  console.log(`    Message 4      : ${emailTotals.msg4 || 0}`);
  console.log(`  Reply rate       : ${replyRate}%`);

  const verticals = dbAll(db, `
    SELECT
      p.vertical,
      COUNT(DISTINCT p.id) AS prospects,
      SUM(CASE WHEN p.status = 'replied' THEN 1 ELSE 0 END) AS replied,
      SUM(CASE WHEN p.status = 'won'     THEN 1 ELSE 0 END) AS won,
      COUNT(DISTINCT CASE WHEN e.status = 'sent' THEN e.id END) AS emails_sent
    FROM prospects p
    LEFT JOIN emails e ON p.id = e.prospect_id
    GROUP BY p.vertical
    ORDER BY replied DESC, emails_sent DESC
  `);

  console.log('\n  BY VERTICAL');
  console.log('  ' + '─'.repeat(56));
  console.log(`  ${'Vertical'.padEnd(18)} ${'Prospects'.padStart(9)} ${'Sent'.padStart(6)} ${'Replied'.padStart(8)} ${'Won'.padStart(5)}`);
  console.log('  ' + '─'.repeat(56));
  for (const v of verticals) {
    console.log(`  ${v.vertical.padEnd(18)} ${String(v.prospects).padStart(9)} ${String(v.emails_sent).padStart(6)} ${String(v.replied).padStart(8)} ${String(v.won).padStart(5)}`);
  }

  const recent = dbAll(db, `
    SELECT ev.event_type, ev.occurred_at, p.company, p.vertical, e.message_number
    FROM events ev
    JOIN prospects p ON ev.prospect_id = p.id
    LEFT JOIN emails e ON ev.email_id = e.id
    ORDER BY ev.occurred_at DESC
    LIMIT 15
  `);

  if (recent.length > 0) {
    console.log('\n  RECENT ACTIVITY');
    console.log('  ' + '─'.repeat(65));
    for (const ev of recent) {
      const date = ev.occurred_at.slice(0, 16).replace('T', ' ');
      const msg  = ev.message_number ? ` msg${ev.message_number}` : '';
      const icon = { sent: '📤', replied: '💬', opted_out: '🚫', failed: '❌', won: '🏆' }[ev.event_type] || '•';
      console.log(`  ${icon} ${date}  ${ev.event_type.padEnd(10)}  ${ev.company.padEnd(28)} ${ev.vertical}${msg}`);
    }
  }

  console.log('\n' + '═'.repeat(65) + '\n');
  db.close();
}

async function exportCsv() {
  const db = await getDb();
  const rows = dbAll(db, `
    SELECT
      p.company, p.first_name, p.last_name, p.email, p.title,
      p.vertical, p.prospect_type, p.status,
      COUNT(DISTINCT CASE WHEN e.status = 'sent' THEN e.id END) AS emails_sent,
      MAX(e.sent_at) AS last_contact
    FROM prospects p
    LEFT JOIN emails e ON p.id = e.prospect_id
    GROUP BY p.id
    ORDER BY p.vertical, p.status
  `);

  const headers = ['company','first_name','last_name','email','title','vertical','prospect_type','status','emails_sent','last_contact'];
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ];

  const outPath = path.join(__dirname, '../db/export.csv');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\n✅  CSV exported to ${outPath} (${rows.length} rows)\n`);
  db.close();
}

module.exports = { report, exportCsv };

if (require.main === module) {
  if (process.argv.includes('--export')) {
    exportCsv().catch(console.error);
  } else {
    report().catch(console.error);
  }
}