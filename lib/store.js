
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { clampWeight, clampProgress } from './weightedProgress';

// ---------------------------------------------------------------------------
// Data layer
// Production: Neon Postgres using DATABASE_URL.
// Demo mode: JSON file storage when DATABASE_URL is not configured.
// ---------------------------------------------------------------------------

export function getIsDemoMode() {
  return !process.env.DATABASE_URL;
}

function db() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }
  return neon(process.env.DATABASE_URL);
}

// ---------------------------------------------------------------------------
// Schema initialization
// ---------------------------------------------------------------------------

let usersSchemaPromise = null;
let tasksSchemaPromise = null;
let settingsSchemaPromise = null;

function ensureUsersSchema() {
  if (getIsDemoMode()) return Promise.resolve();

  if (!usersSchemaPromise) {
    usersSchemaPromise = db()`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `.catch((err) => {
      usersSchemaPromise = null;
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

      // Ensure the users table exists before creating its foreign key.
      await ensureUsersSchema();

      await sql`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          priority TEXT NOT NULL DEFAULT 'normal'
            CHECK (priority IN ('normal', 'critical')),
          progress INTEGER NOT NULL DEFAULT 0
            CHECK (progress BETWEEN 0 AND 100),
          weight INTEGER NOT NULL DEFAULT 1
            CHECK (weight BETWEEN 1 AND 100),
          progress_status TEXT NOT NULL DEFAULT '',
          section TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `;

      // Migrations for existing task tables.
      await sql`
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1
      `;

      await sql`
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS progress_status TEXT NOT NULL DEFAULT ''
      `;

      await sql`
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT ''
      `;

      // Index is an optimization and should not prevent app startup.
      try {
        await sql`
          CREATE INDEX IF NOT EXISTS tasks_user_id_idx
          ON tasks (user_id, start_date)
        `;
      } catch (err) {
        console.warn('[schema] Tasks index skipped:', err.message);
      }
    })().catch((err) => {
      tasksSchemaPromise = null;
      throw err;
    });
  }

  return tasksSchemaPromise;
}

function ensureSettingsSchema() {
  if (getIsDemoMode()) return Promise.resolve();

  if (!settingsSchemaPromise) {
    settingsSchemaPromise = (async () => {
      const sql = db();

      await ensureUsersSchema();

      await sql`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT PRIMARY KEY
            REFERENCES users(id) ON DELETE CASCADE,
          project_title TEXT NOT NULL DEFAULT '',
          project_start DATE,
          project_end DATE,
          meeting_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          meeting_label TEXT NOT NULL DEFAULT ''
        )
      `;

      // Safely migrate existing installations.
      await sql`
        ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS meeting_enabled
        BOOLEAN NOT NULL DEFAULT FALSE
      `;

      await sql`
        ALTER TABLE user_settings
        ADD COLUMN IF NOT EXISTS meeting_label
        TEXT NOT NULL DEFAULT ''
      `;
    })().catch((err) => {
      settingsSchemaPromise = null;
      throw err;
    });
  }

  return settingsSchemaPromise;
}

// ---------------------------------------------------------------------------
// Demo JSON store
// ---------------------------------------------------------------------------

const DATA_FILE = path.join(
  os.tmpdir(),
  'TenTimesBetter-demo-db.json'
);

async function readDemo() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    return {
      users: data.users || [],
      tasks: data.tasks || [],
      settings: data.settings || {},
    };
  } catch {
    return {
      users: [],
      tasks: [],
      settings: {},
    };
  }
}

async function writeDemo(data) {
  await fs.writeFile(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    passwordHash: row.password_hash ?? row.passwordHash,
    createdAt: row.created_at ?? row.createdAt,
  };
}

function mapTaskRow(row) {
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    name: row.name,
    startDate: row.start_date ?? row.startDate,
    endDate: row.end_date ?? row.endDate,
    priority: row.priority,
    progress: row.progress,
    weight: row.weight ?? 1,
    progressStatus:
      row.progress_status ?? row.progressStatus ?? '',
    section: row.section ?? '',
  };
}

function toISODateOrNull(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    return value.length >= 10 ? value.slice(0, 10) : null;
  }

  return null;
}

function mapSettingsRow(row) {
  return {
    projectTitle: row.project_title || '',
    projectStart: toISODateOrNull(row.project_start),
    projectEnd: toISODateOrNull(row.project_end),
    meetingEnabled: row.meeting_enabled === true,
    meetingLabel: row.meeting_label || '',
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function findUserByEmail(email) {
  if (getIsDemoMode()) {
    const data = await readDemo();
    const user = data.users.find((item) => item.email === email);

    if (!user) return null;

    return mapUserRow({
      ...user,
      password_hash: user.passwordHash,
      created_at: user.createdAt,
    });
  }

  await ensureUsersSchema();

  const rows = await db()`
    SELECT id, email, name, password_hash, created_at
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function findUserById(id) {
  if (getIsDemoMode()) {
    const data = await readDemo();
    const user = data.users.find((item) => item.id === id);

    if (!user) return null;

    return mapUserRow({
      ...user,
      password_hash: user.passwordHash,
      created_at: user.createdAt,
    });
  }

  await ensureUsersSchema();

  const rows = await db()`
    SELECT id, email, name, password_hash, created_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows.length ? mapUserRow(rows[0]) : null;
}

export async function insertUser({ email, name, passwordHash }) {
  if (getIsDemoMode()) {
    const data = await readDemo();

    if (data.users.some((user) => user.email === email)) {
      throw Object.assign(
        new Error('Email already registered'),
        { code: 'DUPLICATE_EMAIL' }
      );
    }

    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    data.users.push(user);
    await writeDemo(data);

    return mapUserRow({
      ...user,
      password_hash: user.passwordHash,
      created_at: user.createdAt,
    });
  }

  await ensureUsersSchema();

  // FIX: users has "id", not "user_id".
  // Project settings belong in user_settings, not users.
  const rows = await db()`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (
      ${crypto.randomUUID()},
      ${email},
      ${name},
      ${passwordHash}
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, name, password_hash, created_at
  `;

  if (!rows.length) {
    throw Object.assign(
      new Error('Email already registered'),
      { code: 'DUPLICATE_EMAIL' }
    );
  }

  return mapUserRow(rows[0]);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listTasks(userId) {
  if (getIsDemoMode()) {
    const data = await readDemo();

    return data.tasks
      .filter((task) => task.userId === userId)
      .sort((a, b) =>
        a.startDate < b.startDate
          ? -1
          : a.startDate > b.startDate
            ? 1
            : 0
      )
      .map((task) => ({ ...task }));
  }

  await ensureTasksSchema();

  const rows = await db()`
    SELECT
      id,
      user_id,
      name,
      start_date::text AS start_date,
      end_date::text AS end_date,
      priority,
      progress,
      weight,
      progress_status,
      section
    FROM tasks
    WHERE user_id = ${userId}
    ORDER BY start_date ASC, created_at ASC
  `;

  return rows.map(mapTaskRow);
}

export async function insertTask({
  userId,
  name,
  startDate,
  endDate,
  priority,
  progress,
  weight = 1,
  progressStatus = '',
  section = '',
}) {
  weight = clampWeight(weight);
  progress = clampProgress(progress);

  if (getIsDemoMode()) {
    const data = await readDemo();

    const task = {
      id: crypto.randomUUID(),
      userId,
      name,
      startDate,
      endDate,
      priority,
      progress,
      weight,
      progressStatus,
      section,
    };

    data.tasks.push(task);
    await writeDemo(data);

    return task;
  }

  await ensureTasksSchema();

  const rows = await db()`
    INSERT INTO tasks (
      id,
      user_id,
      name,
      start_date,
      end_date,
      priority,
      progress,
      weight,
      progress_status,
      section
    )
    VALUES (
      ${crypto.randomUUID()},
      ${userId},
      ${name},
      ${startDate},
      ${endDate},
      ${priority},
      ${progress},
      ${weight},
      ${progressStatus},
      ${section}
    )
    RETURNING
      id,
      user_id,
      name,
      start_date::text AS start_date,
      end_date::text AS end_date,
      priority,
      progress,
      weight,
      progress_status,
      section
  `;

  return mapTaskRow(rows[0]);
}

// Only these task fields may be updated.
const TASK_FIELDS = [
  'name',
  'startDate',
  'endDate',
  'priority',
  'progress',
  'weight',
  'progressStatus',
  'section',
];

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
    const data = await readDemo();

    const task = data.tasks.find(
      (item) => item.id === taskId && item.userId === userId
    );

    if (!task) return null;

    const updates = {};

    for (const key of TASK_FIELDS) {
      if (fields[key] === undefined) continue;

      updates[key] =
        key === 'progress'
          ? clampProgress(fields[key])
          : key === 'weight'
            ? clampWeight(fields[key])
            : fields[key];
    }

    Object.assign(task, updates);
    await writeDemo(data);

    return { ...task };
  }

  await ensureTasksSchema();

  const sets = [];
  const params = [];

  for (const key of TASK_FIELDS) {
    if (fields[key] === undefined) continue;

    const value =
      key === 'progress'
        ? clampProgress(fields[key])
        : key === 'weight'
          ? clampWeight(fields[key])
          : fields[key];

    params.push(value);
    sets.push(
      `${TASK_COLUMN_NAMES[key]} = $${params.length}`
    );
  }

  if (!sets.length) return null;

  params.push(taskId, userId);

  const where = `WHERE id = $${params.length - 1}
    AND user_id = $${params.length}`;

  const rows = await db().query(
    `UPDATE tasks
     SET ${sets.join(', ')}
     ${where}
     RETURNING
       id,
       user_id,
       name,
       start_date::text AS start_date,
       end_date::text AS end_date,
       priority,
       progress,
       weight,
       progress_status,
       section`,
    params
  );

  return rows.length ? mapTaskRow(rows[0]) : null;
}

export async function deleteTask(userId, taskId) {
  if (getIsDemoMode()) {
    const data = await readDemo();
    const previousLength = data.tasks.length;

    data.tasks = data.tasks.filter(
      (task) =>
        !(task.id === taskId && task.userId === userId)
    );

    await writeDemo(data);

    return data.tasks.length < previousLength;
  }

  await ensureTasksSchema();

  const rows = await db()`
    DELETE FROM tasks
    WHERE id = ${taskId}
      AND user_id = ${userId}
    RETURNING id
  `;

  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// User settings
// ---------------------------------------------------------------------------

const SETTINGS_DEFAULTS = {
  projectTitle: '',
  projectStart: null,
  projectEnd: null,
  meetingEnabled: false,
  meetingLabel: '',
};

export async function getSettings(userId) {
  if (getIsDemoMode()) {
    const data = await readDemo();
    const settings = data.settings[userId] || {};

    return {
      ...SETTINGS_DEFAULTS,
      projectTitle: settings.projectTitle || '',
      projectStart: settings.projectStart || null,
      projectEnd: settings.projectEnd || null,
      meetingEnabled: settings.meetingEnabled === true,
      meetingLabel: settings.meetingLabel || '',
    };
  }

  await ensureSettingsSchema();

  const rows = await db()`
    SELECT
      user_id,
      project_title,
      project_start::text AS project_start,
      project_end::text AS project_end,
      meeting_enabled,
      meeting_label
    FROM user_settings
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  return rows.length
    ? mapSettingsRow(rows[0])
    : { ...SETTINGS_DEFAULTS };
}

export async function upsertSettings(
  userId,
  {
    projectTitle,
    projectStart,
    projectEnd,
    meetingEnabled,
    meetingLabel,
  }
) {
  if (getIsDemoMode()) {
    const data = await readDemo();

    data.settings = data.settings || {};

    const previous = data.settings[userId] || {};

    data.settings[userId] = {
      projectTitle:
        projectTitle ?? previous.projectTitle ?? '',
      projectStart:
        projectStart ?? previous.projectStart ?? null,
      projectEnd:
        projectEnd ?? previous.projectEnd ?? null,
      meetingEnabled:
        meetingEnabled ?? previous.meetingEnabled ?? false,
      meetingLabel:
        meetingLabel ?? previous.meetingLabel ?? '',
    };

    await writeDemo(data);

    return data.settings[userId];
  }

  await ensureSettingsSchema();

  const rows = await db()`
    INSERT INTO user_settings (
      user_id,
      project_title,
      project_start,
      project_end,
      meeting_enabled,
      meeting_label
    )
    VALUES (
      ${userId},
      ${projectTitle ?? ''},
      ${projectStart ?? null},
      ${projectEnd ?? null},
      ${meetingEnabled === true},
      ${meetingLabel ?? ''}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      project_title = EXCLUDED.project_title,
      project_start = EXCLUDED.project_start,
      project_end = EXCLUDED.project_end,
      meeting_enabled = EXCLUDED.meeting_enabled,
      meeting_label = EXCLUDED.meeting_label
    RETURNING
      user_id,
      project_title,
      project_start::text AS project_start,
      project_end::text AS project_end,
      meeting_enabled,
      meeting_label
  `;

  return mapSettingsRow(rows[0]);
}

// ---------------------------------------------------------------------------
// Database health check
// ---------------------------------------------------------------------------

export async function checkDatabase() {
  if (getIsDemoMode()) {
    return {
      mode: 'demo',
      database: 'not configured — using local temp-file storage',
    };
  }

  try {
    await db()`SELECT 1`;

    return {
      mode: 'production',
      database: 'connected',
    };
  } catch (err) {
    return {
      mode: 'production',
      database: 'error',
      message: err.message,
    };
  }
}
