// ---------------------------------------------------------------------------
// Data layer.
//  - Production: Neon Postgres, via the Neon serverless driver (DATABASE_URL).
//  - No DATABASE_URL set (local dev / sandbox preview): a small JSON file
//    store under ./data so the whole app is testable without a database.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { neon } from '@neondatabase/serverless';

export const isDemoMode = !process.env.DATABASE_URL;

let sql = null;
if (!isDemoMode) sql = neon(process.env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Schema (Neon). Runs once per cold start; tables are created if missing.
// ---------------------------------------------------------------------------
let schemaPromise = null;
function ensureSchema() {
  if (isDemoMode) return Promise.resolve();
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','critical')),
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    })();
    schemaPromise.catch(() => {
      schemaPromise = null; // allow a retry on the next request
    });
  }
  return schemaPromise;
}

// ---------------------------------------------------------------------------
// Demo (file) store helpers
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'demo-db.json');

async function readDemo() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const db = JSON.parse(raw);
    return { users: db.users || [], tasks: db.tasks || [] };
  } catch {
    return { users: [], tasks: [] };
  }
}

async function writeDemo(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
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
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export async function findUserByEmail(email) {
  if (isDemoMode) {
    const db = await readDemo();
    const u = db.users.find((u) => u.email === email);
    return u ? mapUserRow({ ...u, password_hash: u.passwordHash, created_at: u.createdAt }) : null;
  }
  await ensureSchema();
  const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function findUserById(id) {
  if (isDemoMode) {
    const db = await readDemo();
    const u = db.users.find((u) => u.id === id);
    return u ? mapUserRow({ ...u, password_hash: u.passwordHash, created_at: u.createdAt }) : null;
  }
  await ensureSchema();
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function insertUser({ email, name, passwordHash }) {
  if (isDemoMode) {
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
  await ensureSchema();
  const rows = await sql`
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
const TASK_COLUMNS = `id, user_id, name, start_date::text AS start_date, end_date::text AS end_date, priority, progress`;

export async function listTasks(userId) {
  if (isDemoMode) {
    const db = await readDemo();
    return db.tasks
      .filter((t) => t.userId === userId)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
      .map((t) => ({ ...t }));
  }
  await ensureSchema();
  const rows = await sql`
    SELECT ${sql(TASK_COLUMNS)}
    FROM tasks WHERE user_id = ${userId}
    ORDER BY start_date ASC, created_at ASC`;
  return rows.map(mapTaskRow);
}

export async function insertTask({ userId, name, startDate, endDate, priority, progress }) {
  if (isDemoMode) {
    const db = await readDemo();
    const task = { id: crypto.randomUUID(), userId, name, startDate, endDate, priority, progress };
    db.tasks.push(task);
    await writeDemo(db);
    return task;
  }
  await ensureSchema();
  const rows = await sql`
    INSERT INTO tasks (id, user_id, name, start_date, end_date, priority, progress)
    VALUES (${crypto.randomUUID()}, ${userId}, ${name}, ${startDate}, ${endDate}, ${priority}, ${progress})
    RETURNING ${sql(TASK_COLUMNS)}`;
  return mapTaskRow(rows[0]);
}

const TASK_FIELD_COLUMNS = {
  name: 'name',
  startDate: 'start_date',
  endDate: 'end_date',
  priority: 'priority',
  progress: 'progress',
};

export async function updateTask(userId, taskId, fields) {
  if (isDemoMode) {
    const db = await readDemo();
    const task = db.tasks.find((t) => t.id === taskId && t.userId === userId);
    if (!task) return null;
    Object.assign(task, fields);
    await writeDemo(db);
    return { ...task };
  }
  await ensureSchema();
  const sets = [];
  const params = [taskId, userId];
  for (const [key, value] of Object.entries(fields)) {
    const col = TASK_FIELD_COLUMNS[key];
    if (!col) continue;
    params.push(key === 'progress' ? Math.round(value) : value);
    sets.push(`${col} = $${params.length}`);
  }
  if (!sets.length) return null;
  const rows = await sql(
    `UPDATE tasks SET ${sets.join(', ')}
     WHERE id = $1 AND user_id = $2
     RETURNING ${TASK_COLUMNS}`,
    params
  );
  return rows.length ? mapTaskRow(rows[0]) : null;
}

export async function deleteTask(userId, taskId) {
  if (isDemoMode) {
    const db = await readDemo();
    const before = db.tasks.length;
    db.tasks = db.tasks.filter((t) => !(t.id === taskId && t.userId === userId));
    await writeDemo(db);
    return db.tasks.length < before;
  }
  await ensureSchema();
  const rows = await sql`
    DELETE FROM tasks WHERE id = ${taskId} AND user_id = ${userId}
    RETURNING id`;
  return rows.length > 0;
}
