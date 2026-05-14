/* ABOUTME: IndexedDB-backed storage for multiple named ASCII documents. */
/* ABOUTME: Migrates the legacy single-key grid_state store on first open. */
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'ascii_art_db';
const DB_VERSION = 2;
const DOCS_STORE = 'docs';
const META_STORE = 'meta';
const LEGACY_STORE = 'grid_state';
const CURRENT_ID_KEY = 'current_doc_id';

export interface DocRecord {
  id: string;
  name: string;
  width: number;
  height: number;
  buffer: Uint32Array;
  updatedAt: number;
}

export interface DocSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: number;
}

function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export class Storage {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DOCS_STORE)) {
          db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
        if (db.objectStoreNames.contains(LEGACY_STORE)) {
          db.deleteObjectStore(LEGACY_STORE);
        }
      },
    });
  }

  async saveDoc(doc: DocRecord): Promise<void> {
    const db = await this.db;
    await db.put(DOCS_STORE, doc);
  }

  async loadDoc(id: string): Promise<DocRecord | undefined> {
    const db = await this.db;
    return db.get(DOCS_STORE, id);
  }

  async deleteDoc(id: string): Promise<void> {
    const db = await this.db;
    await db.delete(DOCS_STORE, id);
  }

  async listDocs(): Promise<DocSummary[]> {
    const db = await this.db;
    const all = (await db.getAll(DOCS_STORE)) as DocRecord[];
    return all
      .map(({ id, name, width, height, updatedAt }) => ({ id, name, width, height, updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getCurrentId(): Promise<string | undefined> {
    const db = await this.db;
    return db.get(META_STORE, CURRENT_ID_KEY);
  }

  async setCurrentId(id: string): Promise<void> {
    const db = await this.db;
    await db.put(META_STORE, id, CURRENT_ID_KEY);
  }
}

export { randomId };
