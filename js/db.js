// db.js — thin promise-based wrapper around IndexedDB.
// One database, one object store per entity. Generic CRUD so new
// modules can add a store name and get get/getAll/put/remove for free.

const DB_NAME = 'lane1-db';
const DB_VERSION = 1;

export const STORES = [
  'users', 'athletes', 'groups', 'competitions', 'entries', 'results',
  'exercises', 'templates', 'plans', 'sessions', 'actionItems', 'meta'
];

let dbPromise = null;

function openDb(){
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode = 'readonly'){
  return openDb().then(db => db.transaction(store, mode).objectStore(store));
}

export function uid(){
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

export async function getAll(store){
  const os = await tx(store);
  return new Promise((resolve, reject) => {
    const req = os.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function get(store, id){
  const os = await tx(store);
  return new Promise((resolve, reject) => {
    const req = os.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function put(store, obj){
  if (!obj.id) obj.id = uid();
  obj.updatedAt = new Date().toISOString();
  if (!obj.createdAt) obj.createdAt = obj.updatedAt;
  const os = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = os.put(obj);
    req.onsuccess = () => resolve(obj);
    req.onerror = () => reject(req.error);
  });
}

export async function bulkPut(store, items){
  const os = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    items.forEach(it => {
      if (!it.id) it.id = uid();
      os.put(it);
    });
    os.transaction.oncomplete = () => resolve(items);
    os.transaction.onerror = () => reject(os.transaction.error);
  });
}

export async function remove(store, id){
  const os = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = os.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(store){
  const os = await tx(store, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = os.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function countAll(store){
  const items = await getAll(store);
  return items.length;
}

export async function isDbEmpty(){
  const athletes = await getAll('athletes');
  return athletes.length === 0;
}

export async function exportAll(){
  const dump = {};
  for (const s of STORES) dump[s] = await getAll(s);
  return dump;
}

export async function importAll(dump){
  for (const s of STORES) {
    if (dump[s]) { await clearStore(s); await bulkPut(s, dump[s]); }
  }
}

export async function wipeAll(){
  for (const s of STORES) await clearStore(s);
}
