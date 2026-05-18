// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — REPORTER (Supabase version)
// ─────────────────────────────────────────────────────────────────────────────

const { getClient, dbAll } = require('./db');
const fs   = require('fs');
const path = require('path');

async function report() {
  const sb = getClient();
  console.log('\n' + '═'.repeat(65));
  console.log('  ATLAS OUTREACH — REPORT');
  console.log('  ' + new Date().toLocaleString());
  console.log('═'.repeat(65));

  // Prospect totals
  const { data: prospects } = await sb.from('prospects').select('status');
  const total    = prospects.length;
  const active   = prospects.filter(p => p.status === 'active').length;
  const replied  = prospects.filter(p => p.status === 'replied').length;
  const won      = prospects.filter(p => p.status === 'won').length;
  const optedOut = prospects.filter(p => p.status === 'opted_out').length;

  // Email totals
  const { data: emails } = await sb.from('emails').select('message_number, status').eq('status', 'sent');
  const totalSent = emails.length;
  const msg1 = emails.filter(e => e.message_number === 1).length;
  const msg2 = emails.filter(e => e.message_number === 2).length;
  const msg3 = emails.filter(e => e.message_number === 3).length;
  const msg4 = emails.filter(e => e.message_number === 4).length;

  // Reply count
  const { count: replyCount } = await sb.from('events').select('*', { count: 'exact', head: true }).eq('event_type', 'replied');
  const replyRate = msg1 > 0 ? ((replyCount / msg1) * 100).toFixed(1) : '0.0';

  console.log('\n  OVERALL');
  console.log('  ' + '─'.repeat(40));
  console.log(`  Total prospects  : ${total}`);
  console.log(`  Active in cadence: ${active}`);
  console.log(`  Replied          : ${replied}`);
  console.log(`  Won              : ${won}`);
  console.log(`  Opted out        : ${optedOut}`);
  console.log('');
  console.log(`  Emails sent      : ${totalSent}`);
  console.log(`    Message 1      : ${msg1}`);
  console.log(`    Message 2      : ${msg2}`);
  console.log(`    Message 3      : ${msg3}`);
  console.log(`    Message 4      : ${msg4}`);
  console.log(`  Reply rate       : ${replyRate}%`);

  // By vertical
  const { data: allProspects } = await sb.from('prospects').select('vertical, status, id');
  const { data: allEmails }    = await sb.from('emails').select('prospect_id, status');
  const verticals = [...new Set(allProspects.map(p => p.vertical))];

  console.log('\n  BY VERTICAL');
  console.log('  ' + '─'.repeat(56));
  console.log(`  ${'Vertical'.padEnd(18)} ${'Prospects'.padStart(9)} ${'Sent'.padStart(6)} ${'Replied'.padStart(8)} ${'Won'.padStart(5)}`);
  console.log('  ' + '─'.repeat(56));

  for (const v of verticals) {
    const vProspects = allProspects.filter(p => p.vertical === v);
    const vIds       = vProspects.map(p => p.id);
    const vSent      = allEmails.filter(e => vIds.includes(e.prospect_id) && e.status === 'sent').length;
    const vReplied   = vProspects.filter(p => p.status === 'replied').length;
    const vWon       = vProspects.filter(p => p.status === 'won').length;
    console.log(`  ${v.padEnd(18)} ${String(vProspects.length).padStart(9)} ${String(vSent).padStart(6)} ${String(vReplied).padStart(8)} ${String(vWon).padStart(5)}`);
  }

  // Recent activity
  const { data: recent } = await sb
    .from('events')
    .select('event_type, occurred_at, prospect_id, email_id, prospects(company, vertical), emails(message_number)')
    .order('occurred_at', { ascending: false })
    .limit(15);

  console.log('\n  RECENT ACTIVITY');
  console.log('  ' + '─'.repeat(65));
  const icons = { sent: '📤', replied: '💬', opted_out: '🚫', failed: '❌', won: '🏆' };
  for (const ev of recent || []) {
    const date = ev.occurred_at.slice(0, 16).replace('T', ' ');
    const msg  = ev.emails?.message_number ? ` msg${ev.emails.message_number}` : '';
    const icon = icons[ev.event_type] || '•';
    console.log(`  ${icon} ${date}  ${ev.event_type.padEnd(10)}  ${(ev.prospects?.company || '').padEnd(28)} ${ev.prospects?.vertical || ''}${msg}`);
  }

  console.log('\n' + '═'.repeat(65) + '\n');
}

async function exportCsv() {
  const sb = getClient();
  const { data: rows } = await sb
    .from('prospects')
    .select('company, first_name, last_name, email, title, vertical, prospect_type, status');

  const headers = ['company','first_name','last_name','email','title','vertical','prospect_type','status'];
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
  ];

  const outPath = path.join(__dirname, '../db/export.csv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\n✅  CSV exported to ${outPath} (${rows.length} rows)\n`);
}

module.exports = { report, exportCsv };

if (require.main === module) {
  if (process.argv.includes('--export')) {
    exportCsv().catch(console.error);
  } else {
    report().catch(console.error);
  }
}