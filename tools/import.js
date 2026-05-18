// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — SMART IMPORT TOOL
// Usage:
//   node tools/import.js data/ZKTeco.csv [--dry-run] [--skip-dupes]
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const { getClient } = require('../src/db');

const dryRun    = process.argv.includes('--dry-run');
const skipDupes = process.argv.includes('--skip-dupes');
const csvPath   = process.argv.find(a => !a.startsWith('-') && (a.endsWith('.csv') || a.endsWith('.tsv')));

if (!csvPath) {
  console.error('Usage: node tools/import.js path/to/sheet.csv [--dry-run]');
  process.exit(1);
}

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/g;
const URL_RE   = /https?:\/\/[^\s|,\n"]+/gi;
const FORM_KW  = /contact|connect|form|reach|talk|schedule|book/i;

function parseCSV(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delim = text.split('\n')[0].includes('\t') ? '\t' : ',';
  const records = [];
  let pos = 0;

  function parseField() {
    if (pos >= text.length) return '';
    if (text[pos] === '"') {
      pos++;
      let val = '';
      while (pos < text.length) {
        if (text[pos] === '"') {
          if (text[pos+1] === '"') { val += '"'; pos += 2; }
          else { pos++; break; }
        } else {
          val += text[pos++];
        }
      }
      return val.trim();
    } else {
      let val = '';
      while (pos < text.length && text[pos] !== delim && text[pos] !== '\n') {
        val += text[pos++];
      }
      return val.trim();
    }
  }

  function parseRecord() {
    const fields = [];
    while (pos < text.length && text[pos] !== '\n') {
      fields.push(parseField());
      if (pos < text.length && text[pos] === delim) pos++;
    }
    if (pos < text.length && text[pos] === '\n') pos++;
    return fields;
  }

  const headers = parseRecord().map(h => h.toLowerCase());

  while (pos < text.length) {
    const fields = parseRecord();
    if (fields.every(f => !f)) continue;
    const row = {};
    headers.forEach((h, i) => { row[h] = fields[i] || ''; });
    records.push(row);
  }

  return records;
}

function splitCSV(line) {
  const r = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (q && line[i+1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { r.push(cur); cur = ''; }
    else cur += c;
  }
  r.push(cur); return r;
}

function col(row, keys) {
  const k = Object.keys(row).find(k => keys.some(kw => k.includes(kw)));
  return k ? (row[k] || '').trim() : '';
}

function mapRow(row) {
  return {
    vertical:    col(row, ['vertical']),
    company:     col(row, ['company', 'name', 'business']),
    website:     col(row, ['website', 'url', 'site']),
    notes:       col(row, ['notes', 'note', 'description']),
    contactsRaw: col(row, ['contact', 'target']),
  };
}

function normalizeVertical(raw) {
  const v = (raw || '').toLowerCase();
  if (v.includes('gym') || v.includes('fitness') || v.includes('sauna') || v.includes('crossfit')) return 'gym_enduser';
  if (v.includes('pacs') || v.includes('access')) return 'pacs';
  if (v.includes('intercom')) return 'intercom';
  if (v.includes('key')) return 'key_management';
  if (v.includes('daycare') || v.includes('child')) return 'daycare';
  if (v.includes('visitor') || v.includes('vms')) return 'vms';
  return v.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'other';
}

function extractDomain(website) {
  if (!website) return null;
  const d = website.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  return (d.includes('.') && !d.includes(' ')) ? d : null;
}

function cleanNotes(raw) {
  if (!raw) return null;
  let n = raw
    .replace(/hours\s+of\s+operation[\s\S]*?(\n\n|$)/gi, '')
    .replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^\n]*/gi, '')
    .replace(/\d{1,2}:\d{2}\s*(am|pm)\s*[-–to]+\s*\d{1,2}:\d{2}\s*(am|pm)/gi, '')
    .replace(/\d+\s+[A-Z][a-z]+\s+(St|Ave|Blvd|Rd|Dr|Ln|Way|Pl|Ct)[^\n]*/g, '')
    .replace(PHONE_RE, '').replace(URL_RE, '')
    .replace(/\d+\s+locations?\b[.,]?/gi, '')
    .replace(/\s*\|\s*/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  return n || null;
}

function fixEmail(e) {
  return e ? e.replace(/\/com$/, '.com').replace(/\/net$/, '.net').replace(/\/org$/, '.org') : e;
}

function parseContacts(raw) {
  if (!raw?.trim()) return [];
  const text = raw.replace(/nimblefitness\/com/gi, 'nimblefitness.com').replace(/\t/g, ' ');
  const contacts = [];
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (/^https?:\/\/\S+$/.test(line)) continue;
    if (/^\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}$/.test(line)) continue;
    if (/^\d+\s+\w+\s+(St|Ave|Blvd|Rd|Dr|Lane|Way|Pl|Ct|Street|Avenue)\b/i.test(line)) continue;
    if (/^[A-Z][a-z]+,\s*[A-Z]{2}\s*\d{5}/.test(line)) continue;
    if (/^(manhattan|brooklyn|queens|bronx|staten island|nyc|new york)/i.test(line) && line.length < 30) continue;
    if (/\d{1,2}(am|pm)\s*[-–]\s*\d{1,2}(am|pm)/i.test(line)) continue;

    const email  = fixEmail((line.match(EMAIL_RE) || [])[0] || null);
    const phone  = (line.match(PHONE_RE) || [])[0] || null;
    const urls   = (line.match(URL_RE)   || []);
    const form   = urls.find(u => FORM_KW.test(u)) || null;

    let nameChunk = line
      .replace(EMAIL_RE, '').replace(PHONE_RE, '').replace(URL_RE, '')
      .replace(/\|/g, ',').split(',')[0]
      .replace(/^(owner|manager|gm|ceo|founder|co-owner|co-founder)[:\s]*/i, '')
      .replace(/\s*&\s*$/, '').trim();

    const chunks = line.replace(EMAIL_RE,'').replace(PHONE_RE,'').replace(URL_RE,'')
      .split(/[,|]/).map(s => s.trim()).filter(Boolean);

    let title = null;
    if (chunks.length >= 2) {
      const c2 = chunks[1].trim();
      if (/owner|ceo|founder|manager|director|trainer|cpt|gm|partner|co-owner|co-founder|general|president|vp|vice/i.test(c2)) {
        title = c2.replace(/^[&\s]+/, '').replace(/[&\s]+$/, '').trim();
      }
    }
    if (!title) {
      const m = line.match(/\b(Owner|Co-Owner|CEO|Founder|Co-founder|General Manager|GM|Manager|Director|CPT|President)\b/i);
      if (m) title = m[0];
    }

    if (!nameChunk || nameChunk.length < 2 || /^[\W_]+$/.test(nameChunk)) {
      if (email || phone || form) {
        contacts.push({ name: null, title: null, email, phone, contact_form: form,
          status: email ? 'has_email' : form ? 'form_only' : 'phone_only', is_primary: false });
      }
      continue;
    }

    contacts.push({ name: nameChunk, title, email, phone, contact_form: form,
      status: email ? 'has_email' : form ? 'form_only' : phone ? 'phone_only' : 'incomplete',
      is_primary: false });
  }

  // Single-line fallback
  if (contacts.length === 0) {
    const emails = [...(text.match(EMAIL_RE) || [])].map(fixEmail);
    const phones = [...(text.match(PHONE_RE) || [])];
    const forms  = [...(text.match(URL_RE)   || [])].filter(u => FORM_KW.test(u));
    if (emails.length || phones.length || forms.length) {
      contacts.push({ name: null, title: null,
        email: emails[0] || null, phone: phones[0] || null, contact_form: forms[0] || null,
        status: emails[0] ? 'has_email' : forms[0] ? 'form_only' : 'phone_only', is_primary: false });
    }
  }

  const pi = contacts.findIndex(c => c.email);
  if (pi >= 0) contacts[pi].is_primary = true;
  else if (contacts.length > 0) contacts[0].is_primary = true;

  return contacts;
}

function dedupe(rows) {
  const seen = new Map();
  for (const row of rows) {
    if (!row.company) continue;
    const key = row.company.toLowerCase().replace(/\s*\([^)]+\)\s*/g, '').trim();
    if (!seen.has(key)) {
      seen.set(key, { ...row, _contacts: [row.contactsRaw].filter(Boolean) });
    } else {
      const e = seen.get(key);
      if (row.contactsRaw) e._contacts.push(row.contactsRaw);
      if (!e.notes && row.notes) e.notes = row.notes;
      if (!e.website && row.website) e.website = row.website;
    }
  }
  return [...seen.values()].map(r => ({ ...r, contactsRaw: r._contacts.join('\n') }));
}

function makeId(company) {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    + '-' + Date.now().toString(36).slice(-4);
}

async function run() {
  const text  = fs.readFileSync(csvPath, 'utf8');
  const rows  = parseCSV(text);

  const valid = rows.filter(r => {
    const c = col(r, ['company', 'name', 'business']);
    return c && c.length > 1
      && !c.toLowerCase().includes('sample')
      && !c.toLowerCase().startsWith('goal')
      && !c.toLowerCase().startsWith('week');
  });

  console.log(`\n📥  ${valid.length} rows → deduplicating...`);
  const deduped = dedupe(valid.map(mapRow));
  console.log(`   ${deduped.length} unique companies\n`);

  const prospects = deduped.map(row => {
    const contacts = parseContacts(row.contactsRaw);
    const primary  = contacts.find(c => c.is_primary);
    return {
      company:      row.company.trim(),
      vertical:     normalizeVertical(row.vertical),
      website:      row.website?.trim() || null,
      domain:       extractDomain(row.website),
      notes:        cleanNotes(row.notes),
      prospect_type: /software|platform|saas|tech|pos/i.test(row.company) ? 'new_prospect' : 'new_prospect',
      email:        primary?.email || null,
      title:        primary?.title || null,
      contacts,
    };
  });

  // Summary
  const hasEmail  = prospects.filter(p => p.contacts.some(c => c.email)).length;
  const phoneOnly = prospects.filter(p => !p.contacts.some(c => c.email) && p.contacts.some(c => c.phone)).length;
  const formOnly  = prospects.filter(p => !p.contacts.some(c => c.email) && !p.contacts.some(c => c.phone) && p.contacts.some(c => c.contact_form)).length;
  const noContact = prospects.filter(p => p.contacts.every(c => c.status === 'incomplete') || p.contacts.length === 0).length;

  console.log(`  📊  Coverage: ${hasEmail} email / ${phoneOnly} phone / ${formOnly} form / ${noContact} none\n`);

  for (const p of prospects) {
    const icon = p.email ? '✅' : p.contacts.some(c => c.contact_form) ? '📋' : p.contacts.some(c => c.phone) ? '📞' : '⚠ ';
    const summary = p.contacts.length === 0 ? 'no contact info'
      : p.contacts.map(c => [c.name, c.email || c.phone || (c.contact_form ? '(form)' : 'incomplete')].filter(Boolean).join(' ')).join(' | ');
    console.log(`  ${icon} ${p.company.padEnd(42)} ${summary.slice(0, 70)}`);
  }

  if (dryRun) {
    console.log(`\n  DRY RUN — no changes made. Remove --dry-run to import.\n`);
    return;
  }

  const sb = getClient();
  let created = 0, updated = 0, failed = 0;
  console.log(`\n🔄  Importing to Supabase...\n`);

  for (const p of prospects) {
    try {
      const { data: existing } = await sb.from('prospects').select('id').ilike('company', p.company).maybeSingle();
      let id;
      const now = new Date().toISOString();

      if (existing) {
        if (skipDupes) continue;
        await sb.from('prospects').update({
          vertical: p.vertical, website: p.website, notes: p.notes,
          email: p.email, title: p.title, status: 'active', updated_at: now,
        }).eq('id', existing.id);
        id = existing.id; updated++;
      } else {
        id = makeId(p.company);
        await sb.from('prospects').insert({
          id, company: p.company, first_name: null, last_name: null,
          email: p.email, title: p.title, vertical: p.vertical,
          prospect_type: p.prospect_type, status: 'active',
          notes: p.notes, added_at: now, updated_at: now,
        });
        created++;
      }

      await sb.from('contacts').delete().eq('prospect_id', id);
      const toInsert = p.contacts.length > 0 ? p.contacts : [{ status: 'incomplete', is_primary: true }];
      await sb.from('contacts').insert(toInsert.map(c => ({
        prospect_id: id, name: c.name || null, title: c.title || null,
        email: c.email || null, phone: c.phone || null,
        contact_form: c.contact_form || null,
        is_primary: c.is_primary || false, status: c.status || 'incomplete',
      })));
      process.stdout.write('.');
    } catch (err) {
      console.error(`\n  ❌ ${p.company}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n\n  Created: ${created}  Updated: ${updated}  Failed: ${failed}\n`);
}

run().catch(err => { console.error('Import failed:', err.message); process.exit(1); });