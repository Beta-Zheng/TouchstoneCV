import type { PersistStorage, StorageValue } from "zustand/middleware";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Debounce serialization and synchronous localStorage writes; retain pending data on failure. */
export function createBufferedStorage<T extends object>(
  getStorage: () => Storage,
  onStatus: (status: SaveStatus) => void,
  delay = 800,
  validate?: (state: T) => T,
) {
  let pending: { name: string; value: StorageValue<T> } | null = null;
  let latest: StorageValue<T> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let blocked = false;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!pending) return;
    if (blocked) { onStatus("error"); return; }
    try {
      getStorage().setItem(pending.name, JSON.stringify(pending.value));
      pending = null;
      onStatus("saved");
    } catch {
      onStatus("error");
    }
  };
  const storage: PersistStorage<T> = {
    getItem(name) {
      try {
        const raw = getStorage().getItem(name);
        if (!raw) { latest = null; return null; }
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !parsed.state || typeof parsed.state !== "object" || Array.isArray(parsed.state) ||
          (parsed.version !== undefined && parsed.version !== 0)) throw new Error("Invalid stored data");
        latest = { ...parsed, state: validate ? validate(parsed.state) : parsed.state };
        return latest;
      } catch {
        // Preserve unreadable data on disk until an explicit restore or clear operation.
        blocked = true;
        onStatus("error");
        return null;
      }
    },
    setItem(name, value) {
      if (latest && latest.version === value.version && Object.keys(value.state).every((key) =>
        Object.is(value.state[key as keyof T], latest!.state[key as keyof T]))) return;
      latest = value;
      pending = { name, value };
      if (timer) clearTimeout(timer);
      onStatus("saving");
      timer = setTimeout(flush, delay);
    },
    removeItem(name) {
      if (timer) clearTimeout(timer);
      timer = undefined;
      pending = null;
      latest = null;
      getStorage().removeItem(name);
    },
  };
  return { storage, flush, allowRecovery: () => { blocked = false; } };
}
