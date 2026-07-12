const DB_NAME = 'HisabKhataOfflineDB';
const DB_VERSION = 1;

export const initDb = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('groups')) {
        db.createObjectStore('groups', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

const getStore = async (storeName, mode = 'readonly') => {
  const db = await initDb();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
};

export const saveTransactions = async (transactions) => {
  try {
    const store = await getStore('transactions', 'readwrite');
    store.clear();
    transactions.forEach(t => {
      if (t && t._id) {
        store.put(t);
      }
    });
  } catch (err) {
    console.error('Failed to save transactions to IndexedDB:', err);
  }
};

export const getTransactions = async () => {
  try {
    const store = await getStore('transactions', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Failed to get transactions from IndexedDB:', err);
    return [];
  }
};

export const saveCategories = async (categories) => {
  try {
    const store = await getStore('categories', 'readwrite');
    store.clear();
    categories.forEach(c => {
      if (c && c._id) {
        store.put(c);
      }
    });
  } catch (err) {
    console.error('Failed to save categories to IndexedDB:', err);
  }
};

export const getCategories = async () => {
  try {
    const store = await getStore('categories', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Failed to get categories from IndexedDB:', err);
    return [];
  }
};

export const saveGroups = async (groups) => {
  try {
    const store = await getStore('groups', 'readwrite');
    store.clear();
    groups.forEach(g => {
      if (g && g._id) {
        store.put(g);
      }
    });
  } catch (err) {
    console.error('Failed to save groups to IndexedDB:', err);
  }
};

export const getGroups = async () => {
  try {
    const store = await getStore('groups', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Failed to get groups from IndexedDB:', err);
    return [];
  }
};

export const addToQueue = async (type, data) => {
  try {
    const store = await getStore('queue', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add({ type, data, timestamp: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to add to offline queue:', err);
  }
};

export const getQueue = async () => {
  try {
    const store = await getStore('queue', 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.error('Failed to get offline queue:', err);
    return [];
  }
};

export const removeFromQueue = async (id) => {
  try {
    const store = await getStore('queue', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to remove from queue:', err);
  }
};
