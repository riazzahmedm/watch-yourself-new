import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { callEdgeFunction } from "@/lib/supabase";
import { createKVStorage } from "@/lib/kvStorage";

const searchStorage = createKVStorage("search-history");
const HISTORY_KEY = "recent_searches";
const MAX_HISTORY = 8;

export interface SearchResult {
  id:          string;
  tmdbId:      number;
  mediaType:   "movie" | "series";
  title:       string;
  overview:    string;
  posterUrl:   string | null;
  releaseYear: number | null;
  tmdbRating:  number;
}

export function useSearch() {
  const [query, setQuery] = useState("");
  const debouncedQuery    = useDebounce(query, 350);

  const { data, isLoading, error } = useQuery({
    queryKey:  ["search", debouncedQuery],
    queryFn:   () =>
      callEdgeFunction<{ results: SearchResult[] }>("tmdb-search", {
        query: debouncedQuery,
      }).then((r) => r.results),
    enabled:   debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const saveToHistory = useCallback((title: string) => {
    const raw     = searchStorage.getString(HISTORY_KEY);
    const history: string[] = raw ? JSON.parse(raw) : [];
    const updated = [title, ...history.filter((h) => h !== title)].slice(0, MAX_HISTORY);
    searchStorage.set(HISTORY_KEY, JSON.stringify(updated));
  }, []);

  const getHistory = useCallback((): string[] => {
    const raw = searchStorage.getString(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  }, []);

  return {
    query,
    setQuery,
    results:   data ?? [],
    isLoading: isLoading && debouncedQuery.length >= 2,
    error,
    saveToHistory,
    getHistory,
  };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useCallback(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay])();
  return debounced;
}
