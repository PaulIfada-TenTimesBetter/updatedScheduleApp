# TenTimesetter-Scheduler

A Gantt-style project scheduler with **user accounts (email + password)**, **critical vs
normal task priorities**, and a **legend** — built with Next.js, deployed on **Netlify**,
backed by **Neon Postgres**.

## Features

- 🔐 **Accounts & passwords** — anyone must create an account (email + password) before using
  the app. Passwords are hashed with bcrypt and sessions use signed, httpOnly JWT cookies.
- 👤 **Private schedules** — every user sees and manages only their own tasks.
- 🚩 **Priority per task** — when creating or editing a task you pick **Critical** or **Normal**.
- 🗺️ **Legend** — red = critical task, blue = normal task, darker fill = completed progress,
  dashed amber line = today.
- 📈 **Zoomable Gantt timeline** — Day / Week / Month views, weekend shading, today marker,
  progress on each bar, click a bar to edit.
- 📊 Stats: total tasks, critical count, average progress.

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

**Fixed in this version:** the Neon serverless driver v1.x only accepts tagged-template
queries (`sql`…``) or `sql.query("… WHERE x = $1", [x])`. Earlier code used removed calling
styles, which crashed the dashboard task list after login. All database calls now use the
supported forms, and the dashboard shows an error banner instead of crashing if the DB is
unreachable.

