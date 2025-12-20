import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'

const dbCache = new Map<string, Database.Database>()

export function getDb(folder: string): Database.Database {
  if (dbCache.has(folder)) {
    return dbCache.get(folder)!
  }

  const tasksDir = path.join(folder, '.agent', 'tasks')
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true })
  }

  const dbPath = path.join(tasksDir, 'tasks.db')
  const db = new Database(dbPath)

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL')

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo', -- backlog, todo, in-progress, done
      parent_id TEXT,
      position REAL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY(parent_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      task_id TEXT,
      tag_id TEXT,
      PRIMARY KEY(task_id, tag_id),
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dependencies (
      source_task_id TEXT,
      target_task_id TEXT,
      PRIMARY KEY(source_task_id, target_task_id),
      FOREIGN KEY(source_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY(target_task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `)

  dbCache.set(folder, db)
  return db
}
