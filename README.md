# Atlas Outreach

Automated B2B email outreach for ZKTeco USA. Targets independent gym owners and fitness studios with AI-personalized 4-email cadences promoting the Armatura Omni access controller. Prospects are imported from Excel, emails are generated via Gemini/Claude, and sends are fully automated via a daily cron job.

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

Fill in `.env`:
```
ANTHROPIC_API_KEY=       # fallback AI — console.anthropic.com
GEMINI_API_KEY=          # primary AI — aistudio.google.com (free)
RESEND_API_KEY=          # email sending — resend.com
SENDER_FROM=             # verified sending email
SENDER_NAME=             # your name in From field
SENDER_TITLE=            # your title in signature
SENDER_PHONE=            # your phone in signature
REPLY_TO=                # reply-to address
SUPABASE_URL=            # Supabase project URL
SUPABASE_SERVICE_KEY=    # service_role key
UI_PASSWORD=             # dashboard login password
SESSION_SECRET=          # random 32-byte hex string
CRON_TOKEN=              # secret token for /api/run
TEST_EMAIL_OVERRIDE=     # redirect all sends here during testing
MAX_SENDS=12             # cap sends per cron run
CRON_SEND_TIME=08:00     # display time in UI
```

Generate `SESSION_SECRET` and `CRON_TOKEN`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**3. Set up Supabase**

Run the schema SQL in Supabase SQL Editor to create all required tables (`prospects`, `emails`, `events`, `run_log`, `contacts`). Schema available in the Supabase dashboard setup.

**4. Start the UI**
```bash
node run.js --ui
# → http://localhost:3000
```

Sign in with `UI_PASSWORD`.

---

## Importing Prospects

Go to **Targets → ⬆ Import** and upload your Excel (`.xlsx`) or CSV file.

The importer reads from a sheet named **"Formatted for Program"** with these columns:

| Column | Description |
|---|---|
| `vertical` | e.g. `gym_enduser` |
| `company` | Company name (repeated per contact row) |
| `website` | Company website |
| `notes` | Context for AI prompt — hours, gym model, door system info |
| `contact_name` | Person's full name |
| `contact_title` | Job title |
| `contact_email` | Direct email |
| `contact_phone` | Phone number |
| `contact_form` | Contact form URL (if no email) |
| `internal_notes` | Private notes — never passed to AI |

One row per contact. Repeat company name across rows for multi-contact companies — the importer deduplicates and merges contacts automatically.

Download the template: **Targets → ↓ template**

---

## Daily Usage

**Start the dashboard**
```bash
node run.js --ui
```

**Run the full daily job manually (generate + send)**
```bash
node run.js
```

**Dry run — preview only, no sends**
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
│   └── cadence.js        ← Day 0/3/7/14 timing + per-message strategy
├── src/
│   ├── db.js             ← Supabase client
│   ├── generate.js       ← Gemini/Claude email generation
│   ├── scheduler.js      ← decides who gets emailed today
│   ├── sender.js         ← sends via Resend, logs events
│   ├── server.js         ← Express API + dashboard server
│   └── logger.js         ← file + console logger
├── tools/
│   └── import.js         ← CLI prospect importer (CSV/Excel)
├── ui/
│   └── index.html        ← dashboard (Pre-flight, Targets, Report, History)
├── data/                 ← cadence overrides (gitignored)
├── run.js                ← entry point
├── render.yaml           ← Render deployment config
└── .env.example          ← environment variable template
```

---

## Cadence

Adjustable in **Report → Cadence Schedule**. Defaults:

| Message | Day | Strategy |
|---|---|---|
| 1 | 0 | Pain point intro + Omni solution + proof point + free demo unit offer |
| 2 | 3 | New quantified proof point + 15-min call CTA |
| 3 | 7 | Value-add insight + ZKBioSecurity demo video + live demo CTA |
| 4 | 14 | Low-pressure final: pilot program or free demo unit |

Cadence pauses when a prospect is marked `replied`. Resume by updating status in the UI.

---

## Deployment (Render)

**Web service** — runs `node run.js --ui`, serves the dashboard at your Render URL.

**Automated sending** — [cron-job.org](https://cron-job.org) (free) calls `POST /api/run` daily at 8am with the `x-cron-token` header set to `CRON_TOKEN`.

To deploy:
1. Push repo to GitHub
2. Render → New Web Service → connect repo → add all env vars
3. Set up cron-job.org pointing to `https://your-app.onrender.com/api/run`

---

## Verticals

| Vertical | Target | Pitch |
|---|---|---|
| `gym_enduser` | Independent gym / fitness studio owners | Stop credential sharing, eliminate door staffing costs, enable 24/7 unattended access with Armatura Omni |

Add new verticals in `config/templates.js`.

---

## Notes

- **Test mode** — set `TEST_EMAIL_OVERRIDE` to redirect all sends to your inbox. Remove it when ready for real outreach.
- **Gemini rate limit** — free tier is 5 RPM. Scheduler adds a 15s delay between generations to stay under the limit.
- **Resend domain** — test mode uses `onboarding@resend.dev`. Add a verified domain in Resend for production sending.
- **Render free tier** — web service spins down after 15 min inactivity. cron-job.org timeout should be set to 60s to allow for wake-up time.