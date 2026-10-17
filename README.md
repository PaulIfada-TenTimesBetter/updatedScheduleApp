# TenTimesetter-Scheduler

A Gantt-style project scheduler with **user accounts (email + password)**, **critical vs
normal task priorities**, and a **legend** — built with Next.js, deployed on **Netlify**,
backed by **Neon Postgres**.

## Features

- 🔐 **Accounts & passwords** — anyone must create an account (email + password) before using
  the app. Passwords are hashed with bcrypt and sessions use signed, httpOnly JWT cookies.
- 👤 **Private schedules** — every user sees and manages only their own tasks.
- 🚩 **Priority per task** — Critical (red) or Normal (blue), chosen when creating/editing.
- 🗺️ **Legend** — red = critical task, blue = normal task, darker fill = completed progress.
- 📈 **Zoomable Gantt timeline** — Day / Week / Month views, weekend shading, progress on
  each bar, click a bar to edit.
- 📊 **Two sections** — a **📅 Scheduler** tab (the Gantt timeline) and a **📊 Progress
  Tracker** tab (no dates — just each activity's progress bar, editable **weights**, and a
  **Progress Status** comments column). Weights drive a weighted **Overall Project
  Performance** percentage, like a bi-weekly performance sheet.
- 📸 **Snapshot export** — downloads the chart (title, dates, bars, legend) as a
  high-resolution PNG.
- 🌗 **Dark / light mode** — toggle in the header; the choice is remembered per device.
- 📝 **Custom chart title & row label** — click the big title (e.g. "NIGER STATE GAS MASTER
  PLAN") or the row-label box (default "Task") to change what the chart says. Both appear
  in the PNG snapshot too.
- 📊 **Progress toggle** — show progress-filled bars with % inside, or switch to **solid
  bars** to ignore progress entirely.
- 📥 **Excel import** — upload an .xlsx/.xls/.csv, pick the sheet and the **column that
  holds the task names** (date and progress columns optional — auto-detected where
  possible, including files with title rows above the table). Import up to 500 tasks at
  once.
- ⚖️ **Task weight** — set per task (1–100); re-ranks how much each task counts toward
  overall progress.
- 📊 Stats: total tasks, critical count, weighted overall progress.

## Project structure

```
app/                  Pages (landing, login, signup, dashboard) + API routes
  api/auth/…          signup / login / logout
  api/tasks/…         list / create / update / delete (scoped to the logged-in user)
components/           GanttChart, TaskModal, Legend, SchedulerApp, auth forms
lib/auth.js           bcrypt hashing + JWT sessions
lib/store.js          Data layer: Neon Postgres (production) or local JSON file (demo)
db/schema.sql         Neon schema (also auto-created by the app on first request)
netlify.toml          Netlify build config (Next.js runtime)
```

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL + AUTH_SECRET (or leave empty for demo mode)
npm run dev
```

> **Demo mode:** if `DATABASE_URL` is not set, the app runs against a local JSON file
> (`data/demo-db.json`) so you can try everything without a database. Production ignores this.

## Deploy: Neon + Netlify

### 1. Create the Neon database
1. Go to [neon.tech](https://neon.tech) → create (or open) your project.
2. Copy the **connection string** (it looks like
   `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`).

You do **not** need to create tables by hand — the app creates the `users` and `tasks`
tables automatically on first request. (`db/schema.sql` is there if you prefer manual setup.)

### 2. Deploy to Netlify
1. Push this folder to GitHub/GitLab, then in Netlify choose **Add new site → Import an
   existing project** and pick the repo. Netlify auto-detects Next.js via `netlify.toml`.
2. In **Site configuration → Environment variables**, add:
   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | your Neon connection string |
   | `AUTH_SECRET` | a long random string — run `openssl rand -hex 32` |
3. Deploy. Done ✅

*(CLI alternative: `npm i -g netlify-cli && netlify deploy --build --prod`.)*

### 3. Use it
Open the site → **Create account** (email + password) → add tasks, flag which ones are
**Critical**, and read the legend above the chart.

## Notes & security

- Passwords: bcrypt (10 rounds). Sessions: HS256 JWT in an httpOnly, SameSite=Lax cookie,
  valid 7 days. `AUTH_SECRET` must be set in production or sessions reset on each deploy.
- All task API routes are scoped to the session user — users cannot read or modify
  another account's tasks.

## Troubleshooting

**"Application error: a server-side exception has occurred" (with a Digest number)**

1. Open **`https://YOUR-SITE.netlify.app/api/health`** — this is the built-in doctor:
   - `{"mode":"production","database":"connected"}` → the DB is fine; the issue is elsewhere.
   - `{"database":"error","message":"…"}` → read the message; it's almost always the
     `DATABASE_URL` value (see gotchas below).
   - `{"mode":"demo", …}` → `DATABASE_URL` is not reaching the app: check it in Netlify
     **Site configuration → Environment variables**, then redeploy.
2. Env var gotchas:
   - No quotation marks around values pasted into Netlify.
   - The Neon string should include `?sslmode=require` and the correct DB name.
   - Env vars only apply to **new builds** — after changing them, go to
     **Deploys → Trigger deploy → Clear cache and deploy site**.
3. To see the real server error: **Netlify → Logs → Functions** (match the Digest number
   from the error page to the log entry).
4. If you changed `AUTH_SECRET`, old logins become invalid — simply log in again.

**Yellow "Demo mode" banner on the live site**

That banner means `DATABASE_URL` is **not reaching that deploy** — the site is saving
accounts and tasks to a temporary file on Netlify's server, which is wiped regularly.
Symptoms: a login that worked before now says "Invalid email or password", tasks disappear,
and nothing shows up in your Neon `users` table.

Fix: Netlify → **Site configuration → Environment variables** → confirm the key is exactly
`DATABASE_URL` with the raw Neon string (no quotes) → then **Deploys → Trigger deploy →
Clear cache and deploy site** → open `/api/health` and require
`{"mode":"production","database":"connected"}` before signing up again. Any account or task
created while the banner was showing is gone for good — re-create it once connected.

**"Could not create your account. Please try again." (on signup)**

The server could not reach Neon. Open `/api/health` and match the `message`:

| `message` says | Cause → fix |
| --- | --- |
| `fetch failed` / `ENOTFOUND` | Host wrong or unreachable → recopy the **pooled** connection string from Neon → Connect. |
| `password authentication failed…` | Wrong password in the string → reset the role password in Neon or recopy. |
| `Invalid URL` / garbage | Quotes/spaces pasted into the Netlify value → paste the raw string only. |
| `mode:"demo"` | `DATABASE_URL` not reaching the app → check the key name is exactly right, then redeploy. |

Remember: env-var changes only apply after **Deploys → Trigger deploy → Clear cache and
deploy site**.

**Fixed in this version:** the Neon serverless driver v1.x only accepts tagged-template
queries (`sql`…``) or `sql.query("… WHERE x = $1", [x])`. Earlier code used removed calling
styles, which crashed the dashboard task list after login. All database calls now use the
supported forms, and the dashboard shows an error banner instead of crashing if the DB is
unreachable.

