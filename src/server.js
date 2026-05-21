// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — UI SERVER
// Serves the pre-flight dashboard on localhost:3000
// Run via: node run.js --ui
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const { getClient, dbGet, dbAll, dbInsert, dbUpdate } = require('./db');
const { generateEmail }  = require('./generate');
const { sendPendingEmails } = require('./sender');
const cadence  = require('../config/cadence');

const app = express();
app.use(express.json());

// ── PING — lightweight warmup endpoint for cron-job.org ──────────────────────
app.get('/ping', (req, res) => res.send('ok'));

// ── AUTH ──────────────────────────────────────────────────────────────────────
const UI_PASSWORD  = process.env.UI_PASSWORD || 'atlas2024';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_NAME  = 'atlas_session';
const COOKIE_TTL   = 7 * 24 * 60 * 60 * 1000; // 7 days

function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function signToken(token) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex') + '.' + token;
}

function verifyToken(signed) {
  if (!signed) return false;
  const [sig, token] = signed.split('.');
  if (!token) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

function requireAuth(req, res, next) {
  if (req.path === '/login' || req.path === '/api/login' || req.path === '/api/run') return next();
  const cookies = parseCookies(req);
  if (verifyToken(cookies[COOKIE_NAME])) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
  res.redirect('/login');
}

app.use(requireAuth);

// ── LOGIN PAGE ────────────────────────────────────────────────────────────────
app.get('/login', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Atlas Outreach — Login</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #e6edf3; font-family: -apple-system, sans-serif;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px;
      padding: 40px; width: 100%; max-width: 360px; }
    .logo { font-size: 13px; color: #00d4ff; font-weight: 700; letter-spacing: 2px;
      text-transform: uppercase; margin-bottom: 8px; }
    h1 { font-size: 20px; margin-bottom: 24px; color: #e6edf3; }
    label { display: block; font-size: 12px; color: #8b949e; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 14px; background: #0d1117; border: 1px solid #30363d;
      border-radius: 6px; color: #e6edf3; font-size: 14px; outline: none; }
    input:focus { border-color: #00d4ff; }
    button { width: 100%; margin-top: 16px; padding: 10px; background: #00d4ff;
      color: #0d1117; border: none; border-radius: 6px; font-size: 14px;
      font-weight: 700; cursor: pointer; letter-spacing: 1px; }
    button:hover { background: #00b8d9; }
    .error { color: #f85149; font-size: 12px; margin-top: 12px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Atlas Outreach</div>
    <h1>Sign in</h1>
    <label>Password</label>
    <input type="password" id="pw" placeholder="Enter password" onkeydown="if(event.key==='Enter')login()">
    <button onclick="login()">SIGN IN</button>
    <div class="error" id="err">Incorrect password</div>
  </div>
  <script>
    async function login() {
      const pw = document.getElementById('pw').value;
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        document.getElementById('err').style.display = 'block';
      }
    }
  </script>
</body>
</html>`);
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password !== UI_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const token  = makeToken();
  const signed = signToken(token);
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(signed)}; HttpOnly; Path=/; Max-Age=${COOKIE_TTL / 1000}; SameSite=Strict`
  );
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

// Prevent browser caching of the UI
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
});

app.use(express.static(path.join(__dirname, '../ui')));

// ── API: get today's queue ────────────────────────────────────────────────────
app.get('/api/queue', async (req, res) => {
  try {
    const sb  = getClient();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const { data: activeProspects } = await sb
      .from('prospects').select('*').eq('status', 'active');

    // Batch load all drafts in one query instead of one per prospect
    const { data: allDrafts } = await sb
      .from('emails').select('id, prospect_id, message_number, subject, body')
      .eq('status', 'draft');

    // Batch load all sent emails in one query
    const { data: allSentEmails } = await sb
      .from('emails').select('prospect_id, message_number, sent_at')
      .eq('status', 'sent')
      .order('message_number', { ascending: true });

    const draftMap = {};
    for (const d of allDrafts || []) {
      draftMap[`${d.prospect_id}:${d.message_number}`] = d;
    }

    const sentMap = {};
    for (const e of allSentEmails || []) {
      if (!sentMap[e.prospect_id]) sentMap[e.prospect_id] = [];
      sentMap[e.prospect_id].push(e);
    }

    // Get cron send time from env or default to 08:00
    const cronTime = process.env.CRON_SEND_TIME || '08:00';

    const queue = [];

    for (const prospect of activeProspects || []) {
      const sentEmails = sentMap[prospect.id] || [];
      const sentNumbers = sentEmails.map(e => e.message_number);

      for (const step of cadence) {
        if (sentNumbers.includes(step.message_number)) continue;

        let scheduledDate;
        if (step.message_number === 1) {
          scheduledDate = prospect.added_at.split('T')[0];
        } else {
          const msg1 = sentEmails.find(e => e.message_number === 1);
          const baseDate = msg1
            ? new Date(msg1.sent_at)
            : new Date(prospect.added_at);
          baseDate.setDate(baseDate.getDate() + step.send_on_day);
          scheduledDate = baseDate.toISOString().split('T')[0];
        }

        const due = scheduledDate <= today;
        const sendDateObj = new Date(`${scheduledDate}T${cronTime}:00`);
        const scheduledSendAt = sendDateObj.toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        });
        const isOverdue = scheduledDate < today;

        const draft = draftMap[`${prospect.id}:${step.message_number}`] || null;
        const draftNeedsReview = draft ? (
          draft.body?.trimStart().startsWith('SUBJECT:') ||
          draft.subject === `Atlas door controllers — ${prospect.id.split('-')[0]}`||
          draft.subject?.startsWith('Atlas door controllers —')
        ) : false;

        queue.push({
          prospect_id:       prospect.id,
          company:           prospect.company,
          first_name:        prospect.first_name,
          last_name:         prospect.last_name,
          email:             prospect.email,
          title:             prospect.title,
          vertical:          prospect.vertical,
          prospect_type:     prospect.prospect_type,
          message_number:    step.message_number,
          scheduled_date:    scheduledDate,
          scheduled_send_at: scheduledSendAt,
          is_overdue:        isOverdue,
          due,
          notes:             prospect.notes || '',
          extra_context:     '',
          draft_id:          draft?.id || null,
          subject:           draft?.subject || null,
          body:              draft?.body || null,
          draft_updated_at:  null,
          generated:         !!draft,
          needsReview:       draftNeedsReview,
        });
        break;
      }
    }

    // ── SORT QUEUE ─────────────────────────────────────────────────────────────
    // Display: due items alphabetically first, then upcoming by date
    // Generation: contact quality first, then least recently generated

    const GENERIC_PREFIXES = ['info@','contact@','hello@','support@','admin@','gym@','concierge@'];

    function contactScore(item) {
      const email = (item.email || '').toLowerCase();
      if (!email) return 2;
      if (GENERIC_PREFIXES.some(p => email.startsWith(p))) return 1;
      return 0;
    }

    const dueItems = queue
      .filter(q => q.due)
      .sort((a, b) => a.company.localeCompare(b.company));

    const upcomingItems = queue
      .filter(q => !q.due)
      .sort((a, b) => {
        const dateDiff = a.scheduled_date.localeCompare(b.scheduled_date);
        if (dateDiff !== 0) return dateDiff;
        return a.company.localeCompare(b.company);
      });

    // Generation priority order (used by Generate All in UI)
    const generationOrder = [...dueItems].sort((a, b) => {
      const scoreDiff = contactScore(a) - contactScore(b);
      if (scoreDiff !== 0) return scoreDiff;
      const aGen = a.draft_updated_at ? new Date(a.draft_updated_at).getTime() : 0;
      const bGen = b.draft_updated_at ? new Date(b.draft_updated_at).getTime() : 0;
      return aGen - bGen;
    });

    const sortedQueue = [...dueItems, ...upcomingItems];

    res.json({ queue: sortedQueue, generationOrder: generationOrder.map(q => q.prospect_id), today });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: generate a single email ──────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    const { prospect_id, message_number, extra_context, draft_id } = req.body;
    const sb = getClient();
    const { data: prospect } = await sb.from('prospects').select('*').eq('id', prospect_id).single();

    if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

    const enrichedProspect = { ...prospect, extra_context: extra_context || '' };
    const { subject, body, needsReview } = await generateEmail(enrichedProspect, message_number);

    const today = new Date().toISOString().split('T')[0];

    if (draft_id) {
      // Overwrite existing draft
      await sb.from('emails').update({ subject, body }).eq('id', draft_id);
    } else {
      // Save new draft
      await sb.from('emails').insert({
        prospect_id,
        message_number,
        subject,
        body,
        status: 'draft',
        scheduled_for: today,
      });
    }

    // Return the new draft_id so UI can track it
    const { data: saved } = await sb
      .from('emails')
      .select('id')
      .eq('prospect_id', prospect_id)
      .eq('message_number', message_number)
      .eq('status', 'draft')
      .maybeSingle();

    res.json({ subject, body, draft_id: saved?.id, needsReview: !!needsReview });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: queue and send approved emails ───────────────────────────────────────
app.post('/api/send', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const { emails } = req.body;
    if (!emails?.length) {
      send({ type: 'error', message: 'No emails to send' });
      return res.end();
    }

    const { Resend } = require('resend');
    const resend     = new Resend(process.env.RESEND_API_KEY);
    const SENDER_NAME  = process.env.SENDER_NAME  || 'Your Name';
    const SENDER_EMAIL = process.env.SENDER_FROM  || 'you@yourdomain.com';
    const REPLY_TO     = process.env.REPLY_TO     || SENDER_EMAIL;
    const TEST_OVERRIDE = process.env.TEST_EMAIL_OVERRIDE;

    send({ type: 'start', total: emails.length });

    const sb   = getClient();
    const today = new Date().toISOString().split('T')[0];
    let sent = 0, failed = 0;

    for (const item of emails) {
      const { data: prospect } = await sb.from('prospects').select('*').eq('id', item.prospect_id).single();
      if (!prospect) continue;

      try {
        send({ type: 'sending', company: prospect.company, email: prospect.email, message_number: item.message_number });

        const toName    = [prospect.first_name, prospect.last_name].filter(Boolean).join(' ');
        const toAddress = TEST_OVERRIDE
          ? TEST_OVERRIDE  // plain email, no display name, for Resend test mode
          : `${toName} <${prospect.email}>`;

        await resend.emails.send({
          from:     `${SENDER_NAME} <${SENDER_EMAIL}>`,
          to:       toAddress,
          reply_to: REPLY_TO,
          subject:  item.subject,
          text:     item.body,
          headers:  { 'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=unsubscribe>` },
        });

        const now = new Date().toISOString();

        if (item.draft_id) {
          // Promote existing draft to sent
          await sb.from('emails').update({ status: 'sent', sent_at: now }).eq('id', item.draft_id);
        } else {
          // No draft existed — insert as sent directly
          await sb.from('emails').insert({
            prospect_id:    prospect.id,
            message_number: item.message_number,
            subject:        item.subject,
            body:           item.body,
            status:         'sent',
            sent_at:        now,
            scheduled_for:  today,
          });
        }

        await sb.from('events').insert({ prospect_id: prospect.id, event_type: 'sent', occurred_at: now });

        sent++;
        send({ type: 'sent', company: prospect.company, email: prospect.email, message_number: item.message_number });
        await new Promise(r => setTimeout(r, 1200));

      } catch (err) {
        failed++;
        send({ type: 'failed', company: prospect.company, error: err.message });
      }
    }

    send({ type: 'done', sent, failed });
    res.end();

  } catch (err) {
    send({ type: 'error', message: err.message });
    res.end();
  }
});

// ── API: stats for report panel ───────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const sb = getClient();
    const { data: prospects } = await sb.from('prospects').select('status, id, vertical');
    const { data: emails }    = await sb.from('emails').select('message_number, status, prospect_id').eq('status', 'sent');
    const { count: replyCount } = await sb.from('events').select('*', { count: 'exact', head: true }).eq('event_type', 'replied');

    const total   = (prospects || []).length;
    const active  = (prospects || []).filter(p => p.status === 'active').length;
    const replied = (prospects || []).filter(p => p.status === 'replied').length;
    const won     = (prospects || []).filter(p => p.status === 'won').length;
    const totals  = { total, active, replied, won };
    const sent    = (emails || []).length;

    const verticals = [...new Set((prospects || []).map(p => p.vertical))].map(v => {
      const vProspects = (prospects || []).filter(p => p.vertical === v);
      const vIds = vProspects.map(p => p.id);
      return {
        vertical:    v,
        prospects:   vProspects.length,
        replied:     vProspects.filter(p => p.status === 'replied').length,
        emails_sent: (emails || []).filter(e => vIds.includes(e.prospect_id)).length,
      };
    });

    const { data: recentEvents } = await sb
      .from('events')
      .select('event_type, occurred_at, prospect_id, email_id, prospects(company, vertical), emails(message_number)')
      .order('occurred_at', { ascending: false })
      .limit(20);

    const recent = (recentEvents || []).map(ev => ({
      event_type:     ev.event_type,
      occurred_at:    ev.occurred_at,
      prospect_id:    ev.prospect_id,
      company:        ev.prospects?.company,
      vertical:       ev.prospects?.vertical,
      message_number: ev.emails?.message_number,
    }));

    res.json({ totals, sent, verticals, recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/status', async (req, res) => {
  try {
    const { prospect_id, status } = req.body;
    const sb  = getClient();
    const now = new Date().toISOString();
    await sb.from('prospects').update({ status, updated_at: now }).eq('id', prospect_id);
    await sb.from('events').insert({ prospect_id, event_type: status, occurred_at: now });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/prospects', async (req, res) => {
  try {
    const sb = getClient();
    const { data: prospects } = await sb.from('prospects').select('*').order('vertical').order('company');
    res.json({ prospects: prospects || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/prospects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { company, first_name, last_name, email, title, vertical, prospect_type, notes, status } = req.body;
    const sb  = getClient();
    const now = new Date().toISOString();
    await sb.from('prospects').update({
      company, first_name: first_name || null, last_name: last_name || null,
      email, title: title || null, vertical, prospect_type,
      notes: notes || null, status, updated_at: now,
    }).eq('id', id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/prospects', async (req, res) => {
  try {
    const { company, first_name, last_name, email, title, vertical, prospect_type, notes } = req.body;
    if (!company || !email || !vertical || !prospect_type) {
      return res.status(400).json({ error: 'company, email, vertical, and prospect_type are required' });
    }
    const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id   = `${slug}-${Date.now().toString(36)}`;
    const sb   = getClient();
    const now  = new Date().toISOString();
    await sb.from('prospects').insert({
      id, company, first_name: first_name || null, last_name: last_name || null,
      email, title: title || null, vertical, prospect_type,
      status: 'active', notes: notes || null, added_at: now, updated_at: now,
    });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/prospects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sb = getClient();
    await sb.from('events').delete().eq('prospect_id', id);
    await sb.from('emails').delete().eq('prospect_id', id);
    await sb.from('prospects').delete().eq('id', id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: email history for a prospect ────────────────────────────────────────
app.get('/api/history/:prospect_id', async (req, res) => {
  try {
    const sb = getClient();
    const { prospect_id } = req.params;
    const { data: emails } = await sb
      .from('emails')
      .select('id, message_number, subject, body, status, sent_at, scheduled_for')
      .eq('prospect_id', prospect_id)
      .order('message_number', { ascending: true });
    res.json({ emails: emails || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: all sent emails across all prospects ─────────────────────────────────
app.get('/api/history', async (req, res) => {
  try {
    const sb = getClient();
    const { data: emails } = await sb
      .from('emails')
      .select('id, prospect_id, message_number, subject, body, status, sent_at, prospects(company, vertical, email, first_name, last_name)')
      .eq('status', 'sent')
      .order('sent_at', { ascending: false });
    res.json({ emails: emails || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: update draft content ─────────────────────────────────────────────────
app.patch('/api/drafts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body } = req.body;
    const sb = getClient();
    await sb.from('emails').update({ subject, body }).eq('id', id).eq('status', 'draft');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: export report as Excel ───────────────────────────────────────────────
app.get('/api/export', async (req, res) => {
  try {
    const sb = getClient();

    const { data: prospects } = await sb.from('prospects')
      .select('*').neq('status', 'inactive').order('company');

    const { data: emails } = await sb.from('emails')
      .select('*').order('sent_at', { ascending: true });

    const { data: contacts } = await sb.from('contacts')
      .select('*').eq('is_primary', true);

    const contactMap = {};
    for (const c of contacts || []) contactMap[c.prospect_id] = c;

    const emailMap = {};
    for (const e of emails || []) {
      if (!emailMap[e.prospect_id]) emailMap[e.prospect_id] = [];
      emailMap[e.prospect_id].push(e);
    }

    const XLSX = require('xlsx');
    const wb   = XLSX.utils.book_new();

    // ── Sheet 1: Prospect Overview ──
    const overviewRows = [
      ['Company', 'Contact Name', 'Title', 'Email', 'Phone', 'Vertical', 'Status',
       'Msg 1 Sent', 'Msg 2 Sent', 'Msg 3 Sent', 'Msg 4 Sent', 'Notes'],
    ];

    for (const p of prospects || []) {
      const contact = contactMap[p.id];
      const pEmails = emailMap[p.id] || [];
      const sentMap = {};
      for (const e of pEmails) {
        if (e.status === 'sent') sentMap[e.message_number] = e.sent_at?.slice(0,10);
      }
      overviewRows.push([
        p.company,
        [p.first_name, p.last_name].filter(Boolean).join(' ') || '—',
        p.title || '—',
        p.email || '—',
        contact?.phone || '—',
        p.vertical,
        p.status,
        sentMap[1] || '—',
        sentMap[2] || '—',
        sentMap[3] || '—',
        sentMap[4] || '—',
        p.notes || '',
      ]);
    }

    const ws1 = XLSX.utils.aoa_to_sheet(overviewRows);
    ws1['!cols'] = [22,20,18,28,14,12,10,12,12,12,12,40].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Prospect Overview');

    // ── Sheet 2: Sent Emails ──
    const emailRows = [
      ['Company', 'To Email', 'Message #', 'Subject', 'Sent Date', 'Status'],
    ];

    for (const e of (emails || []).filter(e => e.status === 'sent')) {
      const p = (prospects || []).find(x => x.id === e.prospect_id);
      emailRows.push([
        p?.company || e.prospect_id,
        p?.email || '—',
        e.message_number,
        e.subject,
        e.sent_at?.slice(0,10) || '—',
        e.status,
      ]);
    }

    const ws2 = XLSX.utils.aoa_to_sheet(emailRows);
    ws2['!cols'] = [22,28,10,45,12,10].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Sent Emails');

    // ── Sheet 3: Cadence Schedule ──
    const today = new Date().toISOString().split('T')[0];
    const schedRows = [
      ['Company', 'Email', 'Next Message', 'Scheduled Date', 'Status'],
    ];

    const cadence = require('../config/cadence');
    for (const p of prospects || []) {
      const pEmails = (emailMap[p.id] || []).filter(e => e.status === 'sent');
      const sentNums = pEmails.map(e => e.message_number);
      for (const step of cadence) {
        if (sentNums.includes(step.message_number)) continue;
        let scheduledDate;
        if (step.message_number === 1) {
          scheduledDate = p.added_at?.slice(0,10);
        } else {
          const msg1 = pEmails.find(e => e.message_number === 1);
          if (!msg1) break;
          const base = new Date(msg1.sent_at);
          base.setDate(base.getDate() + step.send_on_day);
          scheduledDate = base.toISOString().slice(0,10);
        }
        const status = !scheduledDate ? 'pending'
          : scheduledDate <= today ? 'due now'
          : `scheduled ${scheduledDate}`;
        schedRows.push([p.company, p.email || '—', `Message ${step.message_number}`, scheduledDate || '—', status]);
        break;
      }
    }

    const ws3 = XLSX.utils.aoa_to_sheet(schedRows);
    ws3['!cols'] = [22,28,12,14,20].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws3, 'Cadence Schedule');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `atlas-outreach-report-${today}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: export report as Excel ───────────────────────────────────────────────
app.post('/api/contacts', async (req, res) => {
  try {
    const { prospect_id, name, title, email, phone, contact_form, status, notes, is_primary } = req.body;
    if (!prospect_id) return res.status(400).json({ error: 'prospect_id required' });
    const sb = getClient();
    await sb.from('contacts').insert({
      prospect_id, name: name||null, title: title||null,
      email: email||null, phone: phone||null,
      contact_form: contact_form||null,
      status: status||'incomplete',
      notes: notes||null,
      is_primary: is_primary||false,
    });
    // If this contact has an email and prospect has none, update prospect email
    if (email) {
      const { data: p } = await sb.from('prospects').select('email').eq('id', prospect_id).single();
      if (!p?.email) {
        const nameParts = (name||'').split(' ');
        await sb.from('prospects').update({
          email,
          first_name: nameParts[0]||null,
          last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null,
          title: title||null,
        }).eq('id', prospect_id);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: set primary contact ──────────────────────────────────────────────────
app.patch('/api/contacts/:id/primary', async (req, res) => {
  try {
    const { id } = req.params;
    const { prospect_id } = req.body;
    const sb = getClient();
    // Unset all primaries for this prospect
    await sb.from('contacts').update({ is_primary: false }).eq('prospect_id', prospect_id);
    // Set new primary
    await sb.from('contacts').update({ is_primary: true }).eq('id', id);
    // Update prospect email/name from new primary
    const { data: c } = await sb.from('contacts').select('*').eq('id', id).single();
    if (c?.email) {
      const nameParts = (c.name||'').split(' ');
      await sb.from('prospects').update({
        email: c.email,
        first_name: nameParts[0]||null,
        last_name: nameParts.length > 1 ? nameParts.slice(1).join(' ') : null,
        title: c.title||null,
      }).eq('id', prospect_id);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: get contact counts for all prospects ─────────────────────────────────
app.get('/api/contact-counts', async (req, res) => {
  try {
    const sb = getClient();
    const { data } = await sb.from('contacts').select('prospect_id');
    const counts = {};
    (data || []).forEach(c => {
      counts[c.prospect_id] = (counts[c.prospect_id] || 0) + 1;
    });
    res.json({ counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: get all contacts for a prospect ──────────────────────────────────────
app.get('/api/contacts/:prospect_id', async (req, res) => {
  try {
    const sb = getClient();
    const { data } = await sb.from('contacts')
      .select('*')
      .eq('prospect_id', req.params.prospect_id)
      .order('is_primary', { ascending: false });
    res.json({ contacts: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: bulk import prospects from UI ────────────────────────────────────────
app.post('/api/import', async (req, res) => {
  try {
    const { prospects } = req.body;
    if (!prospects?.length) return res.status(400).json({ error: 'No prospects provided' });

    const sb = getClient();
    let created = 0, updated = 0, failed = 0;

    for (const p of prospects) {
      try {
        if (!p.company) continue;
        const now = new Date().toISOString();

        // Split primary contact name into first/last for prospects table
        const primaryContact = p.contacts?.find(c => c.is_primary);
        const fullName  = primaryContact?.name || '';
        const spaceIdx  = fullName.indexOf(' ');
        const firstName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : (fullName || null);
        const lastName  = spaceIdx > 0 ? fullName.slice(spaceIdx + 1) : null; // null for single-word names

        const { data: existing } = await sb.from('prospects').select('id')
          .ilike('company', p.company).maybeSingle();

        let id;
        if (existing) {
          await sb.from('prospects').update({
            vertical: p.vertical, website: p.website || null,
            notes: p.notes || null, email: p.email || null,
            title: p.title || null,
            first_name: firstName, last_name: lastName,
            status: 'active', updated_at: now,
          }).eq('id', existing.id);
          id = existing.id; updated++;
        } else {
          id = p.company.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)
            + '-' + Date.now().toString(36).slice(-4);
          await sb.from('prospects').insert({
            id, company: p.company,
            first_name: firstName, last_name: lastName,
            email: p.email || null, title: p.title || null,
            vertical: p.vertical, prospect_type: p.prospect_type || 'new_prospect',
            status: 'active', notes: p.notes || null, added_at: now, updated_at: now,
          });
          created++;
        }

        // Replace contacts
        await sb.from('contacts').delete().eq('prospect_id', id);
        const toInsert = (p.contacts?.length > 0) ? p.contacts : [{ status: 'incomplete', is_primary: true }];
        await sb.from('contacts').insert(toInsert.map(c => ({
          prospect_id:    id,
          name:           c.name||null,
          title:          c.title||null,
          email:          c.email||null,
          phone:          c.phone||null,
          contact_form:   c.contact_form||null,
          is_primary:     c.is_primary||false,
          status:         c.status||'incomplete',
          notes:          c.internal_notes||null,
        })));
      } catch (err) {
        failed++;
      }
    }

    res.json({ ok: true, created, updated, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: cadence settings ─────────────────────────────────────────────────────
const CADENCE_OVERRIDE_PATH = path.join(__dirname, '../data/cadence_override.json');

app.get('/api/cadence', (req, res) => {
  const defaultCadence = require('../config/cadence');
  try {
    if (fs.existsSync(CADENCE_OVERRIDE_PATH)) {
      const override = JSON.parse(fs.readFileSync(CADENCE_OVERRIDE_PATH, 'utf8'));
      const merged = defaultCadence.map(step => ({
        ...step,
        send_on_day: override[step.message_number] ?? step.send_on_day,
      }));
      return res.json({ cadence: merged });
    }
  } catch {}
  res.json({ cadence: defaultCadence });
});

app.post('/api/cadence', (req, res) => {
  try {
    const { days } = req.body;
    if (!days) return res.status(400).json({ error: 'days required' });
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(CADENCE_OVERRIDE_PATH, JSON.stringify(days, null, 2));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: trigger cron run via external scheduler ──────────────────────────────
app.post('/api/run', async (req, res) => {
  const token = req.headers['x-cron-token'] || req.query.token;
  if (token !== process.env.CRON_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    res.json({ ok: true, message: 'Run triggered' });
    // Run async after responding so the HTTP request doesn't time out
    const { scheduleTodaysEmails } = require('./scheduler');
    const { sendPendingEmails }    = require('./sender');
    const queued = await scheduleTodaysEmails();
    await sendPendingEmails(queued);
  } catch (err) {
    console.error('Cron run failed:', err.message);
  }
});

function startServer(port = 3000) {
  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`\n🌐  Atlas UI running at http://localhost:${port}\n`);
      resolve(port);
    });
  });
}

module.exports = { startServer };