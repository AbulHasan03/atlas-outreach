# Atlas Outreach Tool

Automated email outreach for Atlas door controller sales. Generates AI-personalized emails per prospect and vertical, runs a 4-touch cadence, and tracks everything in a local SQLite database.

---

## First-Time Setup

**1. Install dependencies**
```bash
npm install
```

**2. Set up your environment variables**
```bash
cp .env.example .env
```
Then edit `.env` and add:
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
- `RESEND_API_KEY` — from [resend.com](https://resend.com) (free: 3,000 emails/month)
- `SENDER_FROM` — your verified sending email/domain in Resend
- `SENDER_NAME` — your name as it appears in the From field

**3. Initialize the database and load prospects**
```bash
npm run setup
# or: node run.js --setup
```

**4. Update contacts in `config/prospects.js`**

Replace the placeholder emails with real contacts. Each prospect has:
- `email` — the recipient's email address
- `first_name` / `last_name` — for personalization
- `title` — their job title
- `prospect_type` — `"new_prospect"` or `"existing_customer"`

After editing prospects.js, re-run setup to sync to the database:
```bash
npm run setup
```

---

## Daily Usage

**Preview what would send today (no emails generated)**
```bash
npm run preview
# or: node run.js --preview
```

**Test generation without sending (generates emails, prints them, doesn't send)**
```bash
npm run dry-run
# or: node run.js --dry-run
```

**Preview a single generated email**
```bash
node run.js --preview-email procare-001
node run.js --preview-email procare-001 --message=2
```

**Run the full daily send**
```bash
npm run send
# or: node run.js
```
This will: (1) generate emails for anyone due today, (2) send them via Resend, (3) print a report.

---

## Managing Prospects

**Mark a prospect as replied (pauses their cadence)**
```bash
node run.js --replied procare-001
```

**Mark a prospect as opted out (never emails again)**
```bash
node run.js --opted-out envoy-001
```

---

## Reporting

**Print performance report**
```bash
npm run report
# or: node run.js --report
```

**Export CSV for CRM import**
```bash
npm run export
# or: node run.js --export
# Output: db/export.csv
```

---

## Vertical Filter

To process only one vertical (useful for testing):
```bash
node run.js --dry-run --vertical=gym
node run.js --vertical=pacs
node run.js --preview --vertical=daycare
```

---

## File Structure

```
atlas-outreach/
├── config/
│   ├── prospects.js    ← your prospect list (edit this)
│   ├── templates.js    ← pain points + value props per vertical
│   └── cadence.js      ← Day 1/4/18/48 timing + strategy
├── src/
│   ├── db.js           ← SQLite database setup + seeding
│   ├── generate.js     ← Claude API email generation
│   ├── scheduler.js    ← decides who gets emailed today
│   ├── sender.js       ← sends via Resend, logs events
│   └── reporter.js     ← prints stats + exports CSV
├── db/
│   └── outreach.db     ← auto-created SQLite file
├── run.js              ← entry point (node run.js)
├── .env                ← your API keys (never commit)
└── .env.example        ← template for .env
```

---

## Cadence

| Message | Day | Strategy |
|---|---|---|
| 1 | 0 | Introduce pain point + Atlas solution + existing customer proof + demo unit offer |
| 2 | 4 | Follow-up: new proof point, soft CTA for 15-min call |
| 3 | 18 | Value-add insight + ZKBioSecurity demo video + live demo CTA |
| 4 | 48 | Final: pilot program / free hardware sample offer |

Cadence pauses automatically when a prospect is marked as `replied`. Resume manually by updating their status.

---

## Adding New Prospects

1. Add entries to `config/prospects.js`
2. Run `node run.js --setup` to sync to the database
3. Run `node run.js --preview` to confirm they're in the schedule
