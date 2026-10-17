// ---------------------------------------------------------------------------
// Data layer.
//  - Production: Neon Postgres, via the Neon serverless driver (DATABASE_URL).
//  - No DATABASE_URL set (local dev / sandbox preview): a small JSON file
//    store in the OS temp dir so the whole app is testable without a database.
//
//  NOTE on the Neon driver (v1.x): `sql` may ONLY be used as a tagged
//  template (sql`SELECT ${value}`) or via sql.query("... WHERE x = $1", [x]).
//  Dynamic SQL strings (e.g. a computed SET clause) must go through
//  sql.query — never sql("...") and never nested sql() fragments.
//
//  Schema notes: users and tasks schemas are ensured SEPARATELY so that a
//  problem with the tasks table (e.g. a pre-existing `tasks` table from an
//  unrelated project, without our columns) can never block signup or login.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { neon } from '@neondatabase/serverless';

/** Demo mode is checked lazily so the value is always read at runtime. */
export function getIsDemoMode() {
  return !process.env.DATABASE_URL;
}

function db() {
  return neon(process.env.DATABASE_URL);
}

// ---------------------------------------------------------------------------
// Schema (Neon) — created once per cold start, per area.
// ---------------------------------------------------------------------------
let usersSchemaPromise = null;
let tasksSchemaPromise = null;

function ensureUsersSchema() {
  if (getIsDemoMode()) return Promise.resolve();
  if (!usersSchemaPromise) {
    usersSchemaPromise = db()
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
      .catch((err) => {
        usersSchemaPromise = null; // allow retry on next request
        throw err;
      });
  }
  return usersSchemaPromise;
}

function ensureTasksSchema() {
  if (getIsDemoMode()) return Promise.resolve();
  if (!tasksSchemaPromise) {
    tasksSchemaPromise = (async () => {
      const sql = db();
      await sql`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','critical')),
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        weight INTEGER NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 100),
        progress_status TEXT NOT NULL DEFAULT '',
        section TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      // Migrations for databases created before these columns existed.
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1`;
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_status TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT ''`;
      // The index is an optimization only — never fail the app over it
      // (e.g. if a foreign `tasks` table without our columns already exists).
      try {
        await sql`CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks (user_id, start_date)`;
      } catch (err) {
        console.warn('[schema] tasks index skipped:', err.message);
      }
    })().catch((err) => {
      tasksSchemaPromise = null; // allow retry on next request
      throw err;
    });
  }
  return tasksSchemaPromise;
}

// ---------------------------------------------------------------------------
// Demo (file) store helpers — stored in the OS temp dir, which is writable
// both locally and on serverless platforms (e.g. Netlify functions).
// ---------------------------------------------------------------------------
const DATA_FILE = path.join(os.tmpdir(), 'tentimesetter-demo-db.json');

async function readDemo() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const db = JSON.parse(raw);
    return {
      users: db.users || [],
      tasks: db.tasks || [],
      settings: db.settings || {},
    };
  } catch {
    return { users: [], tasks: [], settings: {} };
  }
}

async function writeDemo(db) {
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2));
}

// ---------------------------------------------------------------------------
// Row mappers (Neon snake_case -> app camelCase)
// ---------------------------------------------------------------------------
function mapUserRow(r) {
  return {
    id: r.id,
    email: r.email,
    name: r.name || '',
    passwordHash: r.password_hash,
    createdAt: r.created_at,
  };
}

function mapTaskRow(r) {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    priority: r.priority,
    progress: r.progress,
    weight: r.weight ?? 1,
    progressStatus: r.progress_status ?? '',
    section: r.section ?? '',
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function findUserByEmail(email) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    const u = db.users.find((u) => u.email === email);
    return u ? mapUserRow({ ...u, password_hash: u.passwordHash, created_at: u.createdAt }) : null;
  }
  await ensureUsersSchema();
  const rows = await db()`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function findUserById(id) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    const u = db.users.find((u) => u.id === id);
    return u ? mapUserRow({ ...u, password_hash: u.passwordHash, created_at: u.createdAt }) : null;
  }
  await ensureUsersSchema();
  const rows = await db()`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function insertUser({ email, name, passwordHash }) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    if (db.users.some((u) => u.email === email)) {
      throw Object.assign(new Error('Email already registered'), { code: 'DUPLICATE_EMAIL' });
    }
    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    await writeDemo(db);
    return mapUserRow({ ...user, password_hash: user.passwordHash, created_at: user.createdAt });
  }
  await ensureUsersSchema();
  const rows = await db()`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (${crypto.randomUUID()}, ${email}, ${name}, ${passwordHash})
    ON CONFLICT (email) DO NOTHING
    RETURNING *`;
  if (!rows.length) {
    throw Object.assign(new Error('Email already registered'), { code: 'DUPLICATE_EMAIL' });
  }
  return mapUserRow(rows[0]);
}

// ---------------------------------------------------------------------------
// Tasks (always scoped to the owning user)
// ---------------------------------------------------------------------------
export async function listTasks(userId) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    return db.tasks
      .filter((t) => t.userId === userId)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
      .map((t) => ({ ...t }));
  }
  await ensureUsersSchema();
  await ensureTasksSchema();
  const rows = await db()`
    SELECT id, user_id, name,
           start_date::text AS start_date,
           end_date::text AS end_date,
           priority, progress, weight, progress_status, section
    FROM tasks
    WHERE user_id = ${userId}
    ORDER BY start_date ASC, created_at ASC`;
  return rows.map(mapTaskRow);
}

export async function insertTask({ userId, name, startDate, endDate, priority, progress, weight = 1, progressStatus = '', section = '' }) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    const task = { id: crypto.randomUUID(), userId, name, startDate, endDate, priority, progress, weight, progressStatus, section };
    db.tasks.push(task);
    await writeDemo(db);
    return task;
  }
  await ensureUsersSchema();
  await ensureTasksSchema();
  const rows = await db()`
    INSERT INTO tasks (id, user_id, name, start_date, end_date, priority, progress, weight, progress_status, section)
    VALUES (${crypto.randomUUID()}, ${userId}, ${name}, ${startDate}, ${endDate}, ${priority}, ${progress}, ${weight}, ${progressStatus}, ${section})
    RETURNING id, user_id, name,
              start_date::text AS start_date,
              end_date::text AS end_date,
              priority, progress, weight, progress_status`;
  return mapTaskRow(rows[0]);
}

// Only these fields may be written, in any combination.
const TASK_FIELDS = ['name', 'startDate', 'endDate', 'priority', 'progress', 'weight', 'progressStatus', 'section'];
const TASK_COLUMN_NAMES = {
  name: 'name',
  startDate: 'start_date',
  endDate: 'end_date',
  priority: 'priority',
  progress: 'progress',
  weight: 'weight',
  progressStatus: 'progress_status',
  section: 'section',
};

export async function updateTask(userId, taskId, fields) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    const task = db.tasks.find((t) => t.id === taskId && t.userId === userId);
    if (!task) return null;
    Object.assign(task, fields);
    await writeDemo(db);
    return { ...task };
  }
  await ensureUsersSchema();
  await ensureTasksSchema();

  const sets = [];
  const params = [];
  for (const key of TASK_FIELDS) {
    if (fields[key] === undefined) continue;
    params.push(key === 'progress' || key === 'weight' ? Math.round(fields[key]) : fields[key]);
    sets.push(`${TASK_COLUMN_NAMES[key]} = $${params.length}`);
  }
  if (!sets.length) return null;

  params.push(taskId, userId);
  const where = ` WHERE id = $${params.length - 1} AND user_id = $${params.length}`;

  const rows = await db().query(
    `UPDATE tasks SET ${sets.join(', ')}
    ${where}
     RETURNING id, user_id, name,
               start_date::text AS start_date,
               end_date::text AS end_date,
               priority, progress`,
    params
  );
  return rows.length ? mapTaskRow(rows[0]) : null;
}

export async function deleteTask(userId, taskId) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    const before = db.tasks.length;
    db.tasks = db.tasks.filter((t) => !(t.id === taskId && t.userId === userId));
    await writeDemo(db);
    return db.tasks.length < before;
  }
  await ensureUsersSchema();
  await ensureTasksSchema();
  const rows = await db()`
    DELETE FROM tasks WHERE id = ${taskId} AND user_id = ${userId}
    RETURNING id`;
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// User settings (project title + overall project duration) — one row per user.
// ---------------------------------------------------------------------------
let settingsSchemaPromise = null;

function ensureSettingsSchema() {
  if (getIsDemoMode()) return Promise.resolve();
  if (!settingsSchemaPromise) {
    settingsSchemaPromise = db()
      `CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        project_title TEXT NOT NULL DEFAULT '',
        project_start DATE,
        project_end DATE
      )`
      .catch((err) => {
        settingsSchemaPromise = null;
        throw err;
      });
  }
  return settingsSchemaPromise;
}

function mapSettingsRow(r) {
  return {
    projectTitle: r.project_title || '',
    projectStart: r.project_start || null,
    projectEnd: r.project_end || null,
  };
}

export async function getSettings(userId) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    const s = (db.settings || {})[userId] || {};
    return {
      projectTitle: s.projectTitle || '',
      projectStart: s.projectStart || null,
      projectEnd: s.projectEnd || null,
    };
  }
  await ensureUsersSchema();
  await ensureSettingsSchema();
  const rows = await db()`SELECT * FROM user_settings WHERE user_id = ${userId} LIMIT 1`;
  return rows.length ? mapSettingsRow(rows[0]) : { projectTitle: '', projectStart: null, projectEnd: null };
}

export async function upsertSettings(userId, { projectTitle, projectStart, projectEnd }) {
  if (getIsDemoMode()) {
    const db = await readDemo();
    db.settings = db.settings || {};
    const prev = db.settings[userId] || {};
    db.settings[userId] = {
      projectTitle: projectTitle ?? prev.projectTitle ?? '',
      projectStart: projectStart ?? prev.projectStart ?? null,
      projectEnd: projectEnd ?? prev.projectEnd ?? null,
    };
    await writeDemo(db);
    return db.settings[userId];
  }
  await ensureUsersSchema();
  await ensureSettingsSchema();
  const rows = await db()`
    INSERT INTO user_settings (user_id, project_title, project_start, project_end)
    VALUES (${userId}, ${projectTitle || ''}, ${projectStart}, ${projectEnd})
    ON CONFLICT (user_id) DO UPDATE SET
      project_title = EXCLUDED.project_title,
      project_start = EXCLUDED.project_start,
      project_end = EXCLUDED.project_end
    RETURNING *`;
  return mapSettingsRow(rows[0]);
}

// ---------------------------------------------------------------------------
// Health check — used by /api/health so you can verify the Neon connection.
// ---------------------------------------------------------------------------
export async function checkDatabase() {
  if (getIsDemoMode()) {
    return { mode: 'demo', database: 'not configured — using local temp-file storage' };
  }
  try {
    await db()`SELECT 1`;
    return { mode: 'production', database: 'connected' };
  } catch (err) {
    return { mode: 'production', database: 'error', message: err.message };
  }
}
