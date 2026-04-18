// ============================================================
// Offline Log Queue — Zustand + MMKV persistence
//
// Users log from theaters, planes, bad networks.
// Any failed log submission is queued here and auto-flushed
// the next time the app is foregrounded with connectivity.
//
// Queue entry lifecycle:
//   pending   → submitting → done (removed)
//                          ↘ failed (retried up to MAX_RETRIES)
// ============================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import { createKVStorage } from "@/lib/kvStorage";

const kvStorage = createKVStorage("log-queue");

const MAX_RETRIES = 3;

export interface QueuedLog {
  localId:    string;          // uuid generated client-side
  userId:     string;
  mediaId:    string;
  episodeId?: string;
  logType:    "movie" | "series_episode" | "series_season" | "series_full";
  watchedAt:  string;          // ISO date string
  rating?:    number;
  review?:    string;
  moodTagId?: string;
  isRewatch:  boolean;
  isPrivate:  boolean;
  retries:    number;
  status:     "pending" | "submitting" | "failed";
  createdAt:  string;
}

interface LogQueueState {
  queue:    QueuedLog[];
  enqueue:  (log: Omit<QueuedLog, "localId" | "retries" | "status" | "createdAt">) => void;
  flush:    () => Promise<{ submitted: number; failed: number }>;
  remove:   (localId: string) => void;
  pendingCount: number;
}

export const useLogQueue = create<LogQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      pendingCount: 0,

      enqueue: (log) => {
        const entry: QueuedLog = {
          ...log,
          localId:   crypto.randomUUID(),
          retries:   0,
          status:    "pending",
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          queue:        [...state.queue, entry],
          pendingCount: state.queue.length + 1,
        }));
      },

      remove: (localId) =>
        set((state) => {
          const queue = state.queue.filter((l) => l.localId !== localId);
          return { queue, pendingCount: queue.filter((l) => l.status === "pending").length };
        }),

      flush: async () => {
        const { queue } = get();
        const toSubmit = queue.filter(
          (l) => l.status === "pending" || (l.status === "failed" && l.retries < MAX_RETRIES)
        );

        if (toSubmit.length === 0) return { submitted: 0, failed: 0 };

        let submitted = 0;
        let failed    = 0;

        for (const log of toSubmit) {
          // Mark as submitting
          set((state) => ({
            queue: state.queue.map((l) =>
              l.localId === log.localId ? { ...l, status: "submitting" } : l
            ),
          }));

          try {
            const { error } = await supabase.from("logs").insert({
              user_id:     log.userId,
              media_id:    log.mediaId,
              episode_id:  log.episodeId ?? null,
              log_type:    log.logType,
              watched_at:  log.watchedAt,
              rating:      log.rating ?? null,
              review:      log.review ?? null,
              mood_tag_id: log.moodTagId ?? null,
              is_rewatch:  log.isRewatch,
              is_private:  log.isPrivate,
            });

            if (error) throw error;

            // Success — remove from queue
            set((state) => ({
              queue: state.queue.filter((l) => l.localId !== log.localId),
            }));
            submitted++;
          } catch {
            // Failure — increment retries
            set((state) => ({
              queue: state.queue.map((l) =>
                l.localId === log.localId
                  ? { ...l, status: "failed", retries: l.retries + 1 }
                  : l
              ),
            }));
            failed++;
          }
        }

        // Update pending count
        set((state) => ({
          pendingCount: state.queue.filter((l) => l.status === "pending").length,
        }));

        return { submitted, failed };
      },
    }),
    {
      name:    "watch-yourself-log-queue",
      storage: createJSONStorage(() => kvStorage),
      // Only persist the queue array, not the flush function
      partialize: (state) => ({ queue: state.queue }),
    }
  )
);
