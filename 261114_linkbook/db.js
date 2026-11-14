const DATABASE = 'linkbook-local';
const STORE = 'bookmarks';
const VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB is unavailable in this browser.'));
    const req = indexedDB.open(DATABASE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('url', 'url', { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Unable to open local storage.'));
  });
}

async function operate(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      let value;
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error || new Error('Storage operation failed.'));
      transaction.onabort = () => reject(transaction.error || new Error('Storage operation was aborted.'));
      try {
        const req = action(store);
        if (req) req.onsuccess = () => { value = req.result; };
      } catch (error) { transaction.abort(); reject(error); }
    });
  } finally { db.close(); }
}

export const listBookmarks = () => operate('readonly', store => store.getAll());
export const getBookmark = id => operate('readonly', store => store.get(id));
export const getByUrl = url => operate('readonly', store => store.index('url').get(url));
export const saveBookmark = bookmark => operate('readwrite', store => store.put(bookmark));
export const deleteBookmark = id => operate('readwrite', store => store.delete(id));
