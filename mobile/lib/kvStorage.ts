export interface KVStorage {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
}

function createMemoryStorage(): KVStorage {
  const store = new Map<string, string>();
  return {
    getString: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
    delete: (key) => {
      store.delete(key);
    },
  };
}

export function createKVStorage(id: string): KVStorage {
  try {
    // Expo Go does not support NitroModules (MMKV), so requiring can throw.
    const mmkvModule = require("react-native-mmkv") as { MMKV?: new (opts: { id: string }) => KVStorage };
    if (mmkvModule.MMKV) {
      return new mmkvModule.MMKV({ id });
    }
  } catch {
    // Fall back to in-memory storage in Expo Go/development clients.
  }

  return createMemoryStorage();
}
