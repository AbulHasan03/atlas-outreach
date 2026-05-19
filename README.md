# Atlas Outreach

Automated B2B email outreach for ZKTeco USA — targets independent gym owners and fitness studios with personalized 4-email cadences promoting the Armatura Omni access controller. AI-generated emails, Supabase backend, deployed on Render.

---

## How It Works

1. Import prospects from Excel via the UI
2. AI generates personalized emails per prospect using vertical-specific templates
3. A 4-message cadence sends over 14 days (Day 0 / 3 / 7 / 14)
4. Cron job fires daily at 8am — generates drafts and sends automatically
5. Dashboard lets you review, edit, and manually trigger sends

---

## Stack

| Layer | Tool |
|---|---|
| Runtime | Node.js |
| Database | Supabase (PostgreSQL) |
| Email sending | Resend |
| AI generation | Gemini 2.5 Flash (primary) → Claude (fallback) |
| UI | Express + vanilla HTML/JS |
| Hosting | Render (web service) |
| Cron | cron-job.org → `/api/run` endpoint |

---

## Setup

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env`:
```
ANTHROPIC_API_KEY=       # fallback AI (console.anthropic.com)
GEMINI_API_KEY=          # primary AI (aistudio.google.com — free)
RESEND_API_KEY=          # email sending (resend.com)
SENDER_FROM=             # verified sending email
SENDER_NAME=             # your name in From field
SENDER_TITLE=            # your title in signature
SENDER_PHONE=            # your phone in signature
REPLY_TO=                # reply-to address
SUPABASE_URL=            # from Supabase project settings
SUPABASE_SERVICE_KEY=    # service_role key (never expose publicly)
UI_PASSWORD=             # dashboard login password
SESSION_SECRET=          # random 32-byte hex string
CRON_TOKEN=              # secret token for /api/run endpoint
TEST_EMAIL_OVERRIDE=     # redirect all sends here during testing
MAX_SENDS=12             # cap sends per cron run
CRON_SEND_TIME=08:00     # display time in UI
```

Generate `SESSION_SECRET` and `CRON_TOKEN`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**3. Set up Supabase**

Paste the schema from `tools/contacts_schema.sql` into Supabase SQL Editor and run it. This creates all required tables (`prospects`, `emails`, `events`, `run_log`, `contacts`).

**4. Start the UI**
```bash
node run.js --ui
```

Dashboard at `http://localhost:3000` — sign in with `UI_PASSWORD`.

---

## Importing Prospects

Go to **Targets → Import** and upload your Excel file (`.xlsx`) or CSV.

The importer reads from a sheet named **"Formatted for Program"** and expects these columns:

| Column | Description |
|---|---|
| `vertical` | e.g. `gym_enduser` |
| `company` | Company name (repeated per contact row) |
| `website` | Company website URL |
| `notes` | Context for AI prompt (hours, gym model, door system) |
| `contact_name` | Person's full name |
| `contact_title` | Job title |
| `contact_email` | Direct email address |
| `contact_phone` | Phone number |
| `contact_form` | URL to contact form (if no email) |
| `internal_notes` | Private notes — never passed to AI |

One row per contact. Repeat the company name across rows for multi-contact companies. The importer deduplicates by company name and merges contacts automatically.

Download the template from the UI: **Targets → ↓ template**

---

## Daily Usage

**Start the dashboard**
```bash
node run.js --ui
# → http://localhost:3000
```

**Run the full daily send manually (generate + send)**
```bash
node run.js
```

**Dry run (preview only, no sends)**
```bash
node run.js --dry-run
```

**Preview today's schedule**
```bash
node run.js --preview
```

---

## File Structure

```
atlas-outreach/
├── config/
│   ├── templates.js      ← pain points + value props per vertical
│   └── cadence.js        ← Day 0/3/7/14 timing + email strategy
├── src/
│   ├── db.js             ← Supabase client
│   ├── generate.js       ← Gemini/Claude email generation
│   ├── scheduler.js      ← decides who gets emailed today
│   ├── sender.js         ← sends via Resend, logs events
│   ├── server.js         ← Express API + UI server
│   └── logger.js         ← file + console logger
├── tools/
│   ├── import.js         ← CLI prospect importer (CSV/Excel)
│   ├── prep_scraper.js   ← generates ContactScraper input CSV
│   └── merge_contacts.js ← merges ContactScraper results into Supabase
├── ui/
│   └── index.html        ← dashboard (Pre-flight, Targets, Report, History)
├── data/                 ← cadence overrides, scraper CSVs (gitignored)
├── run.js                ← entry point
├── render.yaml           ← Render deployment config
└── .env.example          ← environment variable template
```

---

## Cadence

Default schedule (adjustable in UI → Report → Cadence Schedule):

| Message | Day | Strategy |
|---|---|---|
| 1 | 0 | Pain point intro + Omni solution + proof point + free demo unit offer |
| 2 | 3 | Follow-up: new quantified proof point + 15-min call CTA |
| 3 | 7 | Value-add insight + ZKBioSecurity demo video + live demo CTA |
| 4 | 14 | Low-pressure final: pilot program or free demo unit |

Cadence pauses when a prospect is marked `replied`. Resume by updating their status in the UI.

---

## Deployment (Render)

The app is configured for Render via `render.yaml`.

**Web service** — runs `node run.js --ui`, serves the dashboard publicly.

**Automated sending** — handled by [cron-job.org](https://cron-job.org) (free), which calls `POST /api/run` daily at 8am with the `x-cron-token` header. No Render cron job needed.

To deploy:
1. Push repo to GitHub
2. Render → New Web Service → connect repo → add env vars
3. Set up cron-job.org pointing to `https://your-app.onrender.com/api/run`

---

## Verticals

| Vertical | Target | Pitch |
|---|---|---|
| `gym_enduser` | Independent gym / fitness studio owners | Stop credential sharing, eliminate door staffing, enable 24/7 unattended access with Armatura Omni |

Additional verticals can be added in `config/templates.js`.

---

## Notes

- **Test mode** — set `TEST_EMAIL_OVERRIDE` to redirect all sends to your inbox. Remove it to send to real prospects.
- **Gemini rate limit** — free tier is 5 RPM. The scheduler adds a 15s delay between generations to stay under the limit.
- **Resend domain** — test mode uses `onboarding@resend.dev` (sends to verified account email only). Add a verified domain in Resend for production sending.
- **ContactScraper integration** — `tools/prep_scraper.js` and `tools/merge_contacts.js` are ready for when ContactScraper is mature enough to integrate.