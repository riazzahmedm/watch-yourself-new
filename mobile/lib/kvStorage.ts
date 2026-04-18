// ============================================================
// KV Storage abstraction
//
// Production (dev build):  react-native-mmkv  — synchronous, fast
// Expo Go fallback:        AsyncStorage       — async, works everywhere
//
// IMPORTANT: never import react-native-mmkv at the top level.
// The static import crashes in Expo Go (NitroModules not supported).
// Always use dynamic require() inside a try/catch.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

// Zustand createJSONStorage-compatible interface
export interface ZustandStorage {
  getItem:    (key: string) => string | null | Promise<string | null>;
  setItem:    (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

// Synchronous MMKV adapter (only used when native build is available)
function createMMKVStorage(id: string): ZustandStorage {
  // Dynamic require so the static import never runs in Expo Go
  const { MMKV } = require("react-native-mmkv") as {
    MMKV: new (opts: { id: string }) => {
      getString: (key: string) => string | undefined;
      set:       (key: string, value: string) => void;
      delete:    (key: string) => void;
    };
  };
  const store = new MMKV({ id });
  return {
    getItem:    (key) => store.getString(key) ?? null,
    setItem:    (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  };
}

// AsyncStorage adapter (works in Expo Go)
const asyncStorageAdapter: ZustandStorage = {
  getItem:    (key) => AsyncStorage.getItem(key),
  setItem:    (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

/**
 * Returns an MMKV-backed storage in native builds,
 * AsyncStorage-backed storage in Expo Go.
 */
export function createKVStorage(_id: string): ZustandStorage {
  try {
    return createMMKVStorage(_id);
  } catch {
    return asyncStorageAdapter;
  }
}
