// Minimal IndexedDB wrapper: one key-value store for settings and one store per record kind.
const NAME = 'rybex-vision-lab'
const STORES = ['kv', 'samples', 'features'] as const
type Store = (typeof STORES)[number]
let dbp: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const rq = indexedDB.open(NAME, 1)
      rq.onupgradeneeded = () => { for (const s of STORES) if (!rq.result.objectStoreNames.contains(s)) rq.result.createObjectStore(s) }
      rq.onsuccess = () => resolve(rq.result)
      rq.onerror = () => reject(rq.error)
    })
  }
  return dbp
}
function done<T>(rq: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { rq.onsuccess = () => resolve(rq.result); rq.onerror = () => reject(rq.error) })
}

export async function dbGet<T>(store: Store, key: string): Promise<T | undefined> {
  const db = await open()
  return done(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>
}
export async function dbAll<T>(store: Store): Promise<T[]> {
  const db = await open()
  return done(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>
}
export async function dbKeys(store: Store): Promise<string[]> {
  const db = await open()
  return done(db.transaction(store).objectStore(store).getAllKeys()) as Promise<string[]>
}
export async function dbPutMany(store: Store, items: [string, unknown][]): Promise<void> {
  if (!items.length) return
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  for (const [k, v] of items) tx.objectStore(store).put(v, k)
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error) })
}
export const dbPut = (store: Store, key: string, value: unknown) => dbPutMany(store, [[key, value]])
export async function dbDeleteMany(store: Store, keys: string[]): Promise<void> {
  if (!keys.length) return
  const db = await open()
  const tx = db.transaction(store, 'readwrite')
  for (const k of keys) tx.objectStore(store).delete(k)
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
}
/** Deletes the whole database (Reset the laboratory). */
export async function dbWipe(): Promise<void> {
  if (dbp) { (await dbp).close(); dbp = null }
  await new Promise<void>((resolve) => { const rq = indexedDB.deleteDatabase(NAME); rq.onsuccess = rq.onerror = rq.onblocked = () => resolve() })
}
