import { Asset } from 'expo-asset';
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import sqlWasmModule from 'sql.js/dist/sql-wasm-browser.wasm';

import { SqlJsDatabase } from './sqlJsDatabase';
import type { SqlDatabase } from './SqlDatabase';

const IDB_NAME = 'my-book-reader-db';
const IDB_STORE = 'sqlite';
const IDB_KEY = 'main';
const SAVE_DELAY_MS = 400;

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(IDB_STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('IndexedDB non disponibile'));
  });
}

async function load(): Promise<Uint8Array | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function save(bytes: Uint8Array): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Web: SQLite (sql.js / WebAssembly) in memory, persisted to IndexedDB after
 * every change. Unlike OPFS-based storage it works in every browser (including
 * iPhone Safari and home-screen web apps) and with several tabs open.
 */
export async function createDatabase(): Promise<SqlDatabase> {
  const wasm = Asset.fromModule(sqlWasmModule);
  await wasm.downloadAsync();
  const SQL = await initSqlJs({ locateFile: () => wasm.localUri ?? wasm.uri });
  const saved = await load().catch(() => null);
  const database = saved ? new SQL.Database(saved) : new SQL.Database();

  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    void save(database.export()).catch((error: unknown) => console.warn('[db] save failed', error));
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  };
  // Make sure nothing is lost when the user leaves the app.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) flush();
  });
  window.addEventListener('pagehide', () => timer && flush());

  return new SqlJsDatabase(database, schedule);
}
