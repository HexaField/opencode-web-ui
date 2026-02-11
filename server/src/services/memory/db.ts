import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { AppPaths } from '../../config.js'

export class DatabaseService {
  private db: Database.Database
  private static instance: DatabaseService

  private constructor() {
    const dbPath = path.join(AppPaths.memory, 'knowledge.db')
    // Ensure directory exists (InitService handles this but good for safety)
    if (!fs.existsSync(path.dirname(dbPath))) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    }

    this.db = new Database(dbPath)
    this.initSchema()
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  // For testing purposes
  static resetInstance() {
    DatabaseService.instance = undefined as any
  }

  private initSchema() {
    this.db.pragma('foreign_keys = ON')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY,
        path TEXT UNIQUE NOT NULL,
        last_modified INTEGER NOT NULL,
        hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY,
        file_id INTEGER,
        content TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        embedding BLOB,
        FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        content,
        content='chunks',
        content_rowid='id'
      );

      -- FTS Triggers
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', old.id, old.content);
        INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
      END;
    `)
  }

  public getDb(): Database.Database {
    return this.db
  }

  public close() {
    this.db.close()
  }
}

export const dbService = DatabaseService.getInstance()
