/* ABOUTME: IndexedDB storage for grid state persistence. */
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'ascii_art_db';
const STORE_NAME = 'grid_state';
const DB_VERSION = 1;

export class Storage {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME);
      },
    });
  }

  public async saveState(id: string, state: Uint32Array): Promise<void> {
    const db = await this.db;
    await db.put(STORE_NAME, state, id);
  }

  public async loadState(id: string): Promise<Uint32Array | undefined> {
    const db = await this.db;
    return db.get(STORE_NAME, id);
  }

  public async clearState(id: string): Promise<void> {
    const db = await this.db;
    await db.delete(STORE_NAME, id);
  }
}
