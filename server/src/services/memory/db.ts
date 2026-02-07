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

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        content,
        metadata
      );

      CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, content, metadata) VALUES (new.rowid, new.content, new.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, content, metadata) VALUES('delete', old.rowid, old.content, old.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, content, metadata) VALUES('delete', old.rowid, old.content, old.metadata);
        INSERT INTO documents_fts(rowid, content, metadata) VALUES (new.rowid, new.content, new.metadata);
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
