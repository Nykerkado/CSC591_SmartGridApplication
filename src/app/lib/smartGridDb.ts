import type { SimulationSession, SmartGridRecord } from "./smartGrid";

const DB_NAME = "smart-grid-simulator";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const RECORD_STORE = "records";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        database.createObjectStore(SESSION_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(RECORD_STORE)) {
        const store = database.createObjectStore(RECORD_STORE, { keyPath: "id" });
        store.createIndex("sequence", "sequence", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  handler: (transaction: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    let result: T;

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };

    Promise.resolve(handler(transaction))
      .then((value) => {
        result = value;
      })
      .catch((error) => {
        transaction.abort();
        reject(error);
      });
  });
}

export async function clearSimulationDatabase() {
  await withTransaction([SESSION_STORE, RECORD_STORE], "readwrite", (transaction) => {
    transaction.objectStore(SESSION_STORE).clear();
    transaction.objectStore(RECORD_STORE).clear();
  });
}

export async function saveSession(session: SimulationSession) {
  await withTransaction([SESSION_STORE], "readwrite", (transaction) => {
    transaction.objectStore(SESSION_STORE).put(session);
  });
}

export async function loadSession(): Promise<SimulationSession | null> {
  return withTransaction([SESSION_STORE], "readonly", (transaction) => {
    const request = transaction.objectStore(SESSION_STORE).get("current");

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as SimulationSession | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  });
}

export async function appendRecords(records: SmartGridRecord[]) {
  if (records.length === 0) {
    return;
  }

  await withTransaction([RECORD_STORE], "readwrite", (transaction) => {
    const store = transaction.objectStore(RECORD_STORE);
    records.forEach((record) => store.put(record));
  });
}

export async function loadRecords(): Promise<SmartGridRecord[]> {
  return withTransaction([RECORD_STORE], "readonly", (transaction) => {
    const request = transaction.objectStore(RECORD_STORE).index("sequence").getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve((request.result as SmartGridRecord[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  });
}
