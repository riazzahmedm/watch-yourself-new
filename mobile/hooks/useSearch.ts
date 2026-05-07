import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { callEdgeFunction } from "@/lib/supabase";

// ---- Simple in-memory search history (no MMKV issues in Expo Go)
// Survives session but not app restarts — enough for MVP.
let _historyCache: string[] = [];
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
    _historyCache = [title, ..._historyCache.filter((h) => h !== title)].slice(0, MAX_HISTORY);
  }, []);

  const getHistory = useCallback((): string[] => _historyCache, []);

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

// ---- Correct debounce using useEffect -------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay]);

  return debounced;
}
