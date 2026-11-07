# PRAANA | प्राणा

Supporting life beyond surgery.

PRAANA is a recovery companion for people having cancer surgery, their families, and the care team. After discharge, recovery keeps moving every day. The clinic mostly sees the next appointment. PRAANA holds the days in between as one continuous story, and puts that story in front of a person.

**AI listens, structures, and connects. Humans make clinical decisions.**

PRAANA does not diagnose, prescribe, or replace clinical judgement. Urgent screens point to India’s emergency number **112** and **Tele-MANAS 14416**.

Live demo: [praana-beige.vercel.app](https://praana-beige.vercel.app)

Built for Health-a-thon 2026.

## What a judge can click through

| Role | Account | What you see |
| --- | --- | --- |
| Patient, day 6 after surgery | `priya@demo.praana.care` | Today, check-in, timeline |
| Family caregiver | `rohan@demo.praana.care` | Priya’s story, check-in on her behalf |
| Patient, before surgery (Hindi) | `sunita@demo.praana.care` | Pre-surgery list |
| Surgeon | `doctor@demo.praana.care` | Clinic worklist, patient detail |
| Nurse | `nurse@demo.praana.care` | Same clinic, nurse role |

Password for every seeded account: `praana123`

These accounts exist only in the demo seed. The login screen lists them too.

A short path that shows the product:

1. Sign in as Priya and check in, in her own words.
2. Open **My story** and see today’s entry on the timeline.
3. Ask a recovery question, then a clinical one. The clinical question is refused.
4. Sign in as the surgeon. The worklist marks who needs a person to look.

## Run it locally

Requirements: Node 20 or newer, npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With `DATABASE_URL` left empty, the app uses embedded Postgres (PGlite) in `.data/`. The first boot on an empty database seeds the demo story above. Redis is optional. If it is down, sessions and rate limits stay in memory for that one process.

```bash
npm test
npm run lint
npm run build
```

## Configuration

Copy `.env.example` to `.env.local`. Nothing in `.env.local` belongs in git.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection. Empty uses local PGlite. |
| `REDIS_URL` | Sessions, rate limits, live clinic updates. Optional. |
| `SARVAM_API_KEY` | Preferred model for structuring check-ins and summaries (Indic languages and Hinglish). |
| `OPENAI_API_KEY` | Fallback model, and server-side transcription. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in for patients. Redirect URI: `{APP_URL}/api/auth/callback/google`. |
| `CLINIC_INVITE_CODE` | Required to register a care-team account. |

Without model keys, check-ins are structured by the built-in rules, and the companion answers from the curated recovery library. Safety checks run on those rules either way.

Production schema changes go through `drizzle/`. `npm run db:migrate` applies them when `DATABASE_URL` points at a server.

## How the app is put together

```
src/app            Landing, patient home, clinic, auth, API routes
src/components     Check-in, companion, clinic, guided sessions
src/server         Auth, database, AI providers, domain services
src/lib            Triage rules, recovery insights, shared helpers
src/content        Journey, guided sessions, learning copy (English and Hindi)
drizzle            SQL migrations
```

Three roles share one recovery record, with access checked on the server: patient, caregiver, clinician.

Check-in text is turned into recovery domains (pain, appetite, wound and drain, sleep, mood, and others). A fixed rule set flags warning signs before any model is asked to write. The clinic worklist is a prompt for human review, not a decision.

Provider order for text: Sarvam, then OpenAI, then the local rules. If a provider fails, the rules and the library still hold the experience.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Drizzle ORM · Postgres (Neon in production, PGlite locally) · optional Redis · Sarvam AI · OpenAI

## Sharing boundary

This repository is the product: application code, migrations, tests, and the environment template.

Local secrets (`.env.local`, `credentials/`), the embedded database (`.data/`), and private working files (submission drafts, demo captures, internal notes) stay off GitHub.
