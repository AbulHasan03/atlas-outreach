// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — EMAIL GENERATOR
// Calls the Google Gemini API (free tier) to write a personalized email.
// Returns { subject, body }.
//
// Free tier: 1,500 requests/day, 1M tokens/min — more than enough.
// Get your key at: https://aistudio.google.com (no credit card required)
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const Anthropic             = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger    = require('./logger');
const templates = require('../config/templates');
const cadence   = require('../config/cadence');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

/**
 * Generate a personalized email for a prospect.
 *
 * @param {object} prospect - Row from the prospects table
 * @param {number} messageNumber - 1, 2, 3, or 4
 * @returns {Promise<{ subject: string, body: string }>}
 */
async function generateEmail(prospect, messageNumber) {
  const template = templates[prospect.vertical];
  if (!template) throw new Error(`No template found for vertical: ${prospect.vertical}`);

  const cadenceStep = cadence.find(c => c.message_number === messageNumber);
  if (!cadenceStep) throw new Error(`No cadence step for message number: ${messageNumber}`);

  const prospectAngle = prospect.prospect_type === 'existing_customer'
    ? template.existing_customer
    : template.new_prospect;

  // Fetch previously sent emails for context — strip format headers to avoid confusing the model
  let priorEmails = [];
  if (messageNumber > 1) {
    try {
      const { getClient } = require('./db');
      const sb = getClient();
      const { data } = await sb
        .from('emails')
        .select('message_number, subject, body')
        .eq('prospect_id', prospect.id)
        .eq('status', 'sent')
        .order('message_number', { ascending: true });
      // Strip signature from body to reduce noise
      priorEmails = (data || []).map(e => ({
        ...e,
        body: e.body?.split('\nBest regards,')[0].trim() || e.body,
      }));
    } catch (err) {
      logger.warn('Could not fetch prior emails for context', { error: err.message });
    }
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(prospect, template, prospectAngle, cadenceStep, messageNumber, priorEmails);

  logger.info(`Generating msg ${messageNumber}`, { company: prospect.company, vertical: prospect.vertical });

  let raw;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      raw = await generateWithClaude(systemPrompt, userPrompt);
      logger.success(`Claude generated msg ${messageNumber}`, { company: prospect.company });
    } catch (err) {
      logger.warn(`Claude failed, falling back to Gemini`, { company: prospect.company, error: err.message });
      raw = null;
    }
  }

  if (!raw) {
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
    const result = await geminiModel.generateContent(fullPrompt);
    raw = result.response.text().trim();
    logger.success(`Gemini generated msg ${messageNumber}`, { company: prospect.company });
  }

  return parseEmailResponse(raw, prospect, messageNumber);
}

// ── CLAUDE GENERATOR ─────────────────────────────────────────────────────────

async function generateWithClaude(systemPrompt, userPrompt) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  });
  return response.content[0].text.trim();
}

// ── PRODUCT CATALOG ───────────────────────────────────────────────────────────

const PRODUCT_CATALOG = `
ZKTECO / ARMATURA PRODUCT LINEUP
Pick the 1-2 most relevant products based on the prospect's vertical, notes, and context.
Reference them by name — never speak generically about "hardware" or "our solution."

--- CORE COMPETITIVE ADVANTAGE (use this framing across all verticals) ---
ZKTeco/Armatura readers support virtually any existing RFID credential a customer
already uses — HID, AWID, EM, MIFARE, DESFire, iClass, and others. Customers do NOT
need to re-credential their employees or swap out existing cards and fobs.
Re-credentialing is one of the biggest barriers to hardware adoption: it is expensive,
operationally disruptive, and often a deal-killer. ZKTeco eliminates that friction.
Beyond existing RFID, ZKTeco readers also add QR code and full biometrics (face,
fingerprint, palm vein) — capabilities that competitors like Elatec (RFID/mobile only)
do not offer. This means a prospect can adopt ZKTeco readers with zero disruption to
their installed base, and gain new credential types as an upsell path.

Atlas controller
  Cloud-connected door access controller with a clean OEM API built for software
  developers. Pairs with any Armatura reader. Supports the full credential range:
  existing RFID (no re-credentialing), mobile (Bluetooth/NFC), PIN, QR code,
  fingerprint, face recognition, and palm vein — all on one device.
  No minimum purchase volume. Competitive price vs. Mercury, HID, Allegion.

Omni
  All-in-one reader-controller. Combines reader and controller in a single unit —
  no separate panel needed. Good fit for simpler deployments or companies that want
  a minimal hardware footprint. Same OEM API as Atlas.

Armatura face recognition readers (FR series)
  Biometric readers that identify by face. Cannot be borrowed or shared — critical
  pitch for gyms (credential sharing = revenue leakage) and daycares (verify
  authorized parents). Works alongside existing RFID in the same reader.

Armatura palm vein readers
  Non-contact biometric. Hygienic for high-touch environments: daycares, medical,
  food service. Premium upsell over fingerprint. Unique in the market at this price.

Armatura fingerprint readers
  Fast 1:N matching for high-throughput environments. Lower cost than face/palm.
  Good entry-level biometric upsell for gyms and warehouses.

Multi-tech readers (Armatura multi-credential line)
  Read virtually any RFID format plus biometrics in a single reader. The zero
  re-credentialing story — customers use whatever cards or fobs they already have,
  plus get the option to add biometrics or mobile going forward. Strongest pitch
  when a prospect's customers have a mix of existing credential types.
`.trim();

// ── PROMPT BUILDERS ───────────────────────────────────────────────────────────

function buildSystemPrompt() {
  return `
You are an expert B2B sales copywriter for ZKTeco USA, writing cold outreach emails
on behalf of their sales team. ZKTeco makes Atlas door access controllers, Omni
all-in-one units, and Armatura biometric readers.

RECIPIENT FRAMING:
- For software developers and platform companies: write peer-to-peer, knowledgeable colleague tone.
- For independent gym / fitness studio owners (gym_enduser vertical): write owner-to-owner.
  These are small business operators, not technical people. Lead with money — revenue recovered,
  costs eliminated, hours extended. Skip technical jargon. Make the ROI concrete and fast.
- If no contact name is available: skip the personal greeting entirely. Open directly
  with the pain point or a question about their business. Never write "Hi [Name]" with
  a placeholder, "Dear Owner", or "Hello" — just start with the insight.
- If the email is going to a generic address (info@, contact@, hello@, concierge@):
  address "the owner or manager" rather than a specific person. Do not assume a name.

WRITING RULES:
- Be direct, specific, and concise. No fluff, no buzzwords.
- Never use phrases like "I hope this finds you well", "touching base", "synergy",
  "leverage", "at the end of the day", or any cliché opener.
- Open with the pain point or insight — not an introduction.
- Reference the prospect's company specifically.
- Keep sentences short. One idea per sentence.
- Never use ALL CAPS for emphasis. Use specificity instead.
- Name specific ZKTeco/Armatura products — never speak generically about "hardware."
- When relevant, emphasize that ZKTeco manufactures its entire product line in-house —
  no dependency on third-party component suppliers. Guaranteed availability, consistent quality.

SUBJECT LINE RULES — avoid spam filters:
- Never use: "Last chance", "Final offer", "Final opportunity", "Don't miss", "Act now",
  "Limited time", "Urgent", "Free", "Guaranteed", "No risk", "Risk-free", "Winner",
  "Congratulations", "Claim your", "You've been selected", exclamation marks,
  or dollar amounts ($25,200, $32K, etc.) in the subject line.
- Keep subject lines under 50 characters where possible.
- Subject lines should read like an email from a colleague, not a sales blast.
  Good: "Access control for [Company]" or "Quick question about your front door"
  Bad: "Final Offer: Recover $25,200+ Annually at [Company]!"
- Dollar amounts and ROI stats belong in the body, never the subject.

OUTPUT FORMAT — respond ONLY in this exact format, no extra text, no markdown:
<subject>subject line here</subject>
<body>
email body here — plain text, no HTML, no markdown, blank lines between paragraphs
</body>
  `.trim();
}

function buildUserPrompt(prospect, template, angle, cadenceStep, messageNumber, priorEmails = []) {
  const isExisting = prospect.prospect_type === 'existing_customer';
  const proofPoints = angle.proof_points?.length
    ? `PROOF POINTS TO USE:\n${angle.proof_points.map(p => `- ${p}`).join('\n')}`
    : '';

  // Detect contact type for framing instructions
  const email = prospect.email || '';
  const isGenericEmail = ['info@','contact@','hello@','concierge@','support@','admin@','gym@']
    .some(prefix => email.toLowerCase().startsWith(prefix));
  const hasName = !!(prospect.first_name && prospect.first_name !== 'null');
  const contactFraming = !hasName
    ? 'NO NAME AVAILABLE — do not use a greeting. Open directly with the pain point or insight.'
    : isGenericEmail
    ? `GENERIC EMAIL (${email}) — address "the owner or manager at ${prospect.company}", not a specific person by name.`
    : `Direct contact: ${prospect.first_name} ${prospect.last_name || ''}`.trim();

  // Combine notes and extra_context — never include internal_notes (private research notes)
  const contextParts = [];
  if (prospect.notes) contextParts.push(`Background on this company: ${prospect.notes}`);
  if (prospect.extra_context) contextParts.push(`Additional context added before this send: ${prospect.extra_context}`);
  const prospectContext = contextParts.length
    ? contextParts.join('\n')
    : 'No additional context provided.';

  const priorEmailContext = priorEmails.length > 0 ? `
PRIOR EMAILS SENT TO THIS PROSPECT — do not repeat these points, build on them:
${priorEmails.map(e => `--- Message ${e.message_number} (subject: ${e.subject}) ---\n${e.body}`).join('\n\n')}
` : '';

  // Per-message specific instructions
  const msgInstructions = {
    1: `
MESSAGE 1 SPECIFIC REQUIREMENTS:
- Lead with the pain point immediately. Do not open by introducing yourself or the company.
- Recommend the 1-2 most relevant ZKTeco/Armatura products based on the prospect context.
  Name the product that solves their specific pain and explain why concretely.
- Somewhere natural in the body — not a disclaimer, woven into the flow — briefly note
  that this is the first of 4 emails. One sentence. Transparent, not apologetic.
- End with the low-friction CTA: offer to ship a free demo unit before any commitment.`,

    2: `
MESSAGE 2 SPECIFIC REQUIREMENTS:
- Open with a single brief line referencing the previous email — not "just following up."
  Reference something specific from Message 1 (the pain point or product you mentioned).
- The bulk of this email must be NEW information not in Message 1. Add a specific,
  quantified proof point: a real customer outcome (cost saved, revenue recovered,
  staff hours eliminated, credential sharing stopped). Name the company if possible.
- Keep it very short — 2-3 paragraphs maximum. Respect their time.
- CTA: soft ask for a 15-minute call. Make it easy to say yes or no.
- Do NOT re-introduce Atlas or ZKTeco from scratch. They already know who you are.`,

    3: `
MESSAGE 3 SPECIFIC REQUIREMENTS:
- This is the education email. Go deeper on a specific product capability or use case
  that was NOT covered in emails 1 or 2. Pick a different angle entirely.
- Reference the ZKBioSecurity demo video: youtube.com/watch?v=oCSdoKdaDKo
  Frame it as a concrete resource: "5-minute video that shows exactly how this works
  in a building environment."
- Be genuinely useful — share an insight, stat, or use case specific to their vertical
  that they might not know. This is not a pitch, it's education.
- Escalate CTA to a live product demo. Offer to show them the hardware directly.
- 4-6 paragraphs. This is the longest email in the sequence — make it count.`,

    4: `
MESSAGE 4 SPECIFIC REQUIREMENTS:
- This is the final email. Acknowledge it directly — something like "This is my last
  email on this" — without being apologetic or dramatic about it.
- Make the most comprehensive case: name specific products, include ROI framing,
  cite social proof from companies in their vertical.
- Create mild, genuine urgency (limited pilot hardware, end of quarter pricing, etc.)
  — but don't manufacture fake urgency. Only mention it if it's real.
- Make the final offer crystal clear and easy to act on: one sentence, one action.
- 5-7 paragraphs. Dense and detailed. This is the hard sell.
- Do NOT say "I won't bother you again" or anything passive-aggressive.
  End with confidence, not defeat.`,
  }[messageNumber] || '';

  // Build timing context so AI uses correct time references
  const fs   = require('fs');
  const path = require('path');
  const defaultCadence = require('../config/cadence');
  const overridePath = path.join(__dirname, '../data/cadence_override.json');
  let cadence = defaultCadence;
  try {
    if (fs.existsSync(overridePath)) {
      const override = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
      cadence = defaultCadence.map(s => ({ ...s, send_on_day: override[s.message_number] ?? s.send_on_day }));
    }
  } catch {}

  const timingNote = messageNumber === 1 ? '' :
    `\nTIMING: Do not reference specific time elapsed since the last email unless it flows naturally. If you do reference it, the previous email was sent ${(() => {
      const prevStep = cadence.find(c => c.message_number === messageNumber - 1);
      const thisStep = cadence.find(c => c.message_number === messageNumber);
      const days = thisStep && prevStep ? thisStep.send_on_day - prevStep.send_on_day : null;
      return days === 1 ? 'yesterday' : days === 2 ? 'two days ago' : days === 3 ? 'three days ago' : days <= 7 ? `${days} days ago` : 'last week';
    })()} — do not say "last week" if it was only a few days.`;

  return `
Write Message ${messageNumber} of 4 in a cold outreach email sequence.${timingNote}

PROSPECT DETAILS:
- Company: ${prospect.company}
- Contact framing: ${contactFraming}
- Title: ${prospect.title || 'unknown'}
- Email sending to: ${email}
- Vertical: ${template.vertical_name}
- Prospect type: ${isExisting ? 'EXISTING ATLAS CUSTOMER (expansion/upsell angle)' : 'NEW PROSPECT (cold outreach, no prior relationship)'}

PROSPECT CONTEXT — most important input, use all of it to personalize:
${prospectContext}
${priorEmailContext}
VERTICAL PRODUCT CONTEXT:
${template.product_context.trim()}

PRODUCT CATALOG — pick the 1-2 most relevant based on this prospect's context:
${PRODUCT_CATALOG}

MESSAGE STRATEGY:
- Purpose: ${cadenceStep.purpose}
- Length: ${cadenceStep.length}
- CTA type: ${cadenceStep.cta_type}
- Subject tone: ${cadenceStep.subject_tone}
- Personalization level: ${cadenceStep.personalization_level}

PAIN POINTS (pick the 1-2 most relevant given the prospect context above):
${angle.pain_points.map(p => `- ${p}`).join('\n')}

VALUE PROPOSITIONS (pick the 1-2 most relevant given the prospect context above):
${angle.value_props.map(v => `- ${v}`).join('\n')}

${proofPoints}
${msgInstructions}
Write the email now. Follow the output format exactly. Do NOT include a signature or sign-off — that will be added separately.
  `.trim();
}

// ── RESPONSE PARSER ───────────────────────────────────────────────────────────

function parseEmailResponse(raw, prospect, messageNumber) {
  // Primary: XML tag format <subject>...</subject> <body>...</body>
  const subjectXml = raw.match(/<subject>([\s\S]+?)<\/subject>/i);
  const bodyXml    = raw.match(/<body>([\s\S]+?)<\/body>/i);

  // Fallback: old SUBJECT:/BODY: format
  const subjectLegacy = raw.match(/^SUBJECT:\s*(.+)/m);
  const bodyLegacy    = raw.match(/^BODY:\s*\n([\s\S]+)/m);

  let subject = (subjectXml?.[1] || subjectLegacy?.[1] || '').trim();
  let body    = (bodyXml?.[1]    || bodyLegacy?.[1]    || '').trim();

  let needsReview = false;

  // Greedy fallback: if we have a subject but no body, everything after the subject line is the body
  if (subject && !body) {
    needsReview = true;
    logger.warn('No body tag found — using greedy fallback', { company: prospect.company, message_number: messageNumber });
    body = raw
      .replace(/<subject>[\s\S]+?<\/subject>/i, '')
      .replace(/^SUBJECT:\s*.+$/m, '')
      .replace(/^BODY:\s*$/m, '')
      .trim();
  }

  // Last resort fallback
  if (!subject) {
    needsReview = true;
    logger.warn('Could not parse email response — using fallback subject', { company: prospect.company, message_number: messageNumber });
    subject = `Atlas door controllers — ${prospect.company}`;
    body    = raw.trim();
  }

  // Clean up any leftover XML tags or format markers from the body
  body = body
    .replace(/<\/?subject>/gi, '')
    .replace(/<\/?body>/gi, '')
    .replace(/^SUBJECT:\s*.+$/gm, '')
    .replace(/^BODY:\s*$/gm, '')
    .trim();

  const signature = [
    '',
    'Best regards,',
    `${process.env.SENDER_NAME || '[Your Name]'} | ${process.env.SENDER_TITLE || '[Your Title]'}`,
    `ZKTeco USA | ${process.env.SENDER_PHONE || '[Phone]'} | ${process.env.SENDER_FROM || '[Email]'}`,
    'atlas.zktecousa.com',
  ].join('\n');

  return { subject, body: body + '\n' + signature, needsReview };
}

// ── PREVIEW MODE: generate and print without saving ───────────────────────────

async function previewEmail(prospectId, messageNumber = 1) {
  const { getDb, dbGet } = require('./db');
  const db = await getDb();
  const prospect = dbGet(db, `SELECT * FROM prospects WHERE id = ?`, [prospectId]);
  db.close();

  if (!prospect) {
    console.error(`Prospect not found: ${prospectId}`);
    process.exit(1);
  }

  console.log(`\n📧  Preview: ${prospect.company} — Message ${messageNumber}\n`);
  const email = await generateEmail(prospect, messageNumber);
  console.log('─'.repeat(60));
  console.log(`SUBJECT: ${email.subject}`);
  console.log('─'.repeat(60));
  console.log(email.body);
  console.log('─'.repeat(60));

  return email;
}

module.exports = { generateEmail, previewEmail };

// Run directly: node src/generate.js <prospect_id> [message_number]
// Example:      node src/generate.js procare-001 1
if (require.main === module) {
  const [,, prospectId, msgNum] = process.argv;
  if (!prospectId) {
    console.error('Usage: node src/generate.js <prospect_id> [message_number]');
    process.exit(1);
  }
  previewEmail(prospectId, parseInt(msgNum) || 1).catch(console.error);
}