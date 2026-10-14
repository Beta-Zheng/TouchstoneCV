import type { PersistStorage, StorageValue } from "zustand/middleware";
import type { SaveStatus } from "./storage";

type Ref = { $documentRef: string };
export interface PackedDocument {
  manifest: unknown;
  records: Map<string, unknown>;
  assets: Map<string, string>;
}
export interface DocumentBackend {
  read(name: string): Promise<PackedDocument | null>;
  write(name: string, document: PackedDocument): Promise<void>;
  remove(name: string): Promise<void>;
}

/** Content addressing shares unchanged entries, images and source text across versions. */
export async function packDocument(value: unknown): Promise<PackedDocument> {
  const records = new Map<string, unknown>();
  const assets = new Map<string, string>();
  const hashes = new Map<string, string>();
  const hash = async (s: string) => {
    if (!hashes.has(s)) {
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(s)
      );
      hashes.set(
        s,
        Array.from(new Uint8Array(bytes), (b) =>
          b.toString(16).padStart(2, "0")
        ).join("")
      );
    }
    return hashes.get(s)!;
  };
  const encode = async (v: unknown, key = ""): Promise<unknown> => {
    if (
      typeof v === "string" &&
      v &&
      ["avatar_url", "school_badge_url", "source_text"].includes(key)
    ) {
      const id = `asset:${await hash(v)}`;
      assets.set(id, v);
      return { $documentRef: id };
    }
    if (Array.isArray(v)) return Promise.all(v.map((x) => encode(x, key)));
    if (v && typeof v === "object") {
      const result = Object.fromEntries(
        await Promise.all(
          Object.entries(v).map(async ([k, x]) => [k, await encode(x, k)])
        )
      );
      // Basic info, entries and full data become shared records, rather than copies per snapshot.
      if (
        "block_id" in result ||
        "sections" in result ||
        "basic_info" === key
      ) {
        const id = `record:${await hash(JSON.stringify(result))}`;
        records.set(id, result);
        return { $documentRef: id };
      }
      return result;
    }
    return v;
  };
  return { manifest: await encode(value), records, assets };
}
export function unpackDocument(document: PackedDocument): unknown {
  const active = new Set<string>();
  const decode = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(decode);
    if (v && typeof v === "object") {
      if (Object.keys(v).length === 1 && "$documentRef" in v) {
        const id = (v as Ref).$documentRef;
        if (typeof id !== "string" || active.has(id))
          throw new Error("Invalid document reference");
        if (id.startsWith("asset:")) {
          if (!document.assets.has(id))
            throw new Error("Missing document asset");
          return document.assets.get(id)!;
        }
        if (!document.records.has(id))
          throw new Error("Missing document record");
        active.add(id);
        const result = decode(document.records.get(id));
        active.delete(id);
        return result;
      }
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, decode(x)])
      );
    }
    return v;
  };
  return decode(document.manifest);
}

const requestValue = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("Storage transaction aborted"));
    tx.onerror = () => reject(tx.error);
  });
export function indexedDocumentBackend(): DocumentBackend {
  let revision = 0;
  const database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("touchstonecv", 1);
    request.onupgradeneeded = () => {
      for (const name of ["manifest", "records", "assets"])
        request.result.createObjectStore(name);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Database upgrade blocked"));
  });
  // Observe a failed open immediately, even before hydration requests the database.
  void database.catch(() => undefined);
  return {
    async read(name) {
      const db = await database;
      const tx = db.transaction(["manifest", "records", "assets"], "readonly");
      const done = transactionDone(tx);
      const [manifest, recordKeys, recordValues, assetKeys, assetValues] =
        await Promise.all([
          requestValue(tx.objectStore("manifest").get(name)),
          requestValue(tx.objectStore("records").getAllKeys()),
          requestValue(tx.objectStore("records").getAll()),
          requestValue(tx.objectStore("assets").getAllKeys()),
          requestValue(tx.objectStore("assets").getAll()),
          done,
        ]);
      revision = manifest?.revision ?? 0;
      return manifest === undefined
        ? null
        : {
            manifest: manifest.body,
            records: new Map(
              recordKeys.map((k, i) => [String(k), recordValues[i]])
            ),
            assets: new Map(
              assetKeys.map((k, i) => [String(k), assetValues[i]])
            ),
          };
    },
    async write(name, document) {
      const db = await database;
      const tx = db.transaction(["manifest", "records", "assets"], "readwrite");
      const done = transactionDone(tx);
      const expected = revision;
      const head = tx.objectStore("manifest").get(name);
      head.onsuccess = () => {
        // Detect edits in another tab instead of silently overwriting them.
        if ((head.result?.revision ?? 0) !== expected) {
          tx.abort();
          return;
        }
        // Issue mutations inside IDB callbacks to keep the transaction alive in every browser.
        for (const storeName of ["records", "assets"] as const) {
          const store = tx.objectStore(storeName);
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            const existing = new Set(keys.result.map(String));
            for (const [key, value] of document[storeName])
              if (!existing.has(key)) store.put(value, key);
            for (const key of existing)
              if (!document[storeName].has(key)) store.delete(key);
          };
        }
        tx.objectStore("manifest").put(
          { revision: expected + 1, body: document.manifest },
          name
        );
      };
      await done;
      revision = expected + 1;
    },
    async remove(name) {
      const db = await database;
      const tx = db.transaction(["manifest", "records", "assets"], "readwrite");
      const done = transactionDone(tx);
      tx.objectStore("manifest").delete(name);
      tx.objectStore("records").clear();
      tx.objectStore("assets").clear();
      await done;
      revision = 0;
    },
  };
}

/** Serial, debounced saves. A failed migration never removes the legacy copy. */
export function createDocumentStorage<T extends object>(
  backend: DocumentBackend,
  legacy: () => Storage,
  onStatus: (status: SaveStatus) => void,
  validate: (state: T) => T,
  delay = 800
) {
  let pending: { name: string; value: StorageValue<T> } | null = null;
  let latest: StorageValue<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let blocked = false;
  let working: Promise<void> | null = null;
  const flush = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    if (working) return working.then(() => (pending ? flush() : undefined));
    if (!pending) return Promise.resolve();
    if (blocked) {
      onStatus("error");
      return Promise.resolve();
    }
    const current = pending;
    pending = null;
    working = (async () => {
      try {
        await backend.write(current.name, await packDocument(current.value));
        // Delete legacy only after the new transaction has committed.
        try {
          legacy().removeItem(current.name);
        } catch {
          /* IDB remains authoritative. */
        }
        onStatus(pending ? "saving" : "saved");
      } catch {
        if (!pending) pending = current;
        onStatus("error");
      } finally {
        working = null;
      }
    })();
    return working;
  };
  const checked = (value: unknown): StorageValue<T> => {
    const data = value as StorageValue<T>;
    if (
      !data ||
      typeof data !== "object" ||
      !data.state ||
      Array.isArray(data.state) ||
      (data.version !== undefined && data.version !== 0)
    )
      throw new Error("Invalid stored document");
    return { ...data, state: validate(data.state) };
  };
  const storage: PersistStorage<T> = {
    async getItem(name) {
      try {
        const document = await backend.read(name);
        if (document) {
          latest = checked(unpackDocument(document));
          return latest;
        }
        const raw = legacy().getItem(name);
        if (!raw) return null;
        latest = checked(JSON.parse(raw));
        // Return valid legacy data even when migration fails, but preserve its bytes.
        try {
          await backend.write(name, await packDocument(latest));
          legacy().removeItem(name);
        } catch {
          pending = { name, value: latest };
          onStatus("error");
        }
        return latest;
      } catch {
        blocked = true;
        onStatus("error");
        return null;
      }
    },
    setItem(name, value) {
      if (
        latest &&
        Object.keys(value.state).every((k) =>
          Object.is(value.state[k as keyof T], latest!.state[k as keyof T])
        )
      )
        return;
      latest = value;
      pending = { name, value };
      clearTimeout(timer);
      onStatus("saving");
      timer = setTimeout(() => void flush(), delay);
    },
    async removeItem(name) {
      clearTimeout(timer);
      pending = null;
      if (working) await working;
      pending = null;
      await backend.remove(name);
      legacy().removeItem(name);
      latest = null;
    },
  };
  return {
    storage,
    flush,
    allowRecovery: () => {
      blocked = false;
    },
  };
}
