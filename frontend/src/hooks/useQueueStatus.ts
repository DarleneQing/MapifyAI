import { useState, useEffect, useCallback, useRef } from "react";

export type QueueLevel = "low" | "medium" | "busy";

export interface QueueInfo {
  placeId: string;
  level: QueueLevel;
  waitMinutes: number;
  peopleAhead: number;
}

export interface UserQueuePosition {
  placeId: string;
  placeName: string;
  position: number;
  estimatedWaitMinutes: number;
  joinedAt: number;
}

// Mock queue data for places (IDs from seed zurich_providers.json)
const MOCK_QUEUE_DATA: Record<string, { level: QueueLevel; waitMinutes: number; peopleAhead: number }> = {
  p001: { level: "low", waitMinutes: 2, peopleAhead: 1 },
  p002: { level: "medium", waitMinutes: 10, peopleAhead: 4 },
  p003: { level: "busy", waitMinutes: 25, peopleAhead: 9 },
  p004: { level: "low", waitMinutes: 0, peopleAhead: 0 },
  p005: { level: "medium", waitMinutes: 15, peopleAhead: 6 },
  p006: { level: "busy", waitMinutes: 20, peopleAhead: 7 },
  p007: { level: "low", waitMinutes: 3, peopleAhead: 1 },
  p008: { level: "medium", waitMinutes: 12, peopleAhead: 5 },
  p009: { level: "busy", waitMinutes: 30, peopleAhead: 11 },
  p010: { level: "low", waitMinutes: 0, peopleAhead: 0 },
  // New queues near Stadelhofen area (massage category)
  p081: { level: "medium", waitMinutes: 18, peopleAhead: 7 },
  p082: { level: "busy", waitMinutes: 28, peopleAhead: 10 },
};

export function useQueueStatus() {
  const [queues, setQueues] = useState<Record<string, QueueInfo>>(
    () => {
      const initial: Record<string, QueueInfo> = {};
      Object.entries(MOCK_QUEUE_DATA).forEach(([id, data]) => {
        initial[id] = { placeId: id, ...data };
      });
      return initial;
    }
  );

  const [userQueue, setUserQueue] = useState<UserQueuePosition | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Simulate real-time queue fluctuation - DISABLED for prototyping
  // Uncomment to enable live queue simulation
  // useEffect(() => {
  //   intervalRef.current = window.setInterval(() => {
  //     setQueues((prev) => {
  //       const next = { ...prev };
  //       const ids = Object.keys(next);
  //       const count = 2 + Math.floor(Math.random() * 2);
  //       for (let i = 0; i < count; i++) {
  //         const id = ids[Math.floor(Math.random() * ids.length)];
  //         const q = { ...next[id] };
  //         const delta = Math.random() > 0.5 ? 1 : -1;
  //         q.peopleAhead = Math.max(0, q.peopleAhead + delta);
  //         q.waitMinutes = Math.max(0, q.peopleAhead * 3);
  //         q.level = q.peopleAhead <= 2 ? "low" : q.peopleAhead <= 6 ? "medium" : "busy";
  //         next[id] = q;
  //       }
  //       return next;
  //     });
  //   }, 8000);
  //   return () => {
  //     if (intervalRef.current) clearInterval(intervalRef.current);
  //   };
  // }, []);

  // Simulate user queue position countdown
  useEffect(() => {
    if (!userQueue) return;
    const timer = window.setInterval(() => {
      setUserQueue((prev) => {
        if (!prev || prev.position <= 0) {
          clearInterval(timer);
          return null;
        }
        const elapsed = (Date.now() - prev.joinedAt) / 1000;
        // Move forward roughly 1 position every 45 seconds for simulation
        const positionsAdvanced = Math.floor(elapsed / 45);
        const newPosition = Math.max(0, prev.position - positionsAdvanced > 0 ? prev.position - positionsAdvanced : 0);
        const newWait = Math.max(0, newPosition * 3);
        if (newPosition <= 0) {
          return null; // Done!
        }
        return { ...prev, position: newPosition, estimatedWaitMinutes: newWait };
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [userQueue?.placeId]);

  const joinQueue = useCallback((placeId: string, placeName: string) => {
    const queue = queues[placeId];
    const position = queue ? queue.peopleAhead + 1 : 1;
    setUserQueue({
      placeId,
      placeName,
      position,
      estimatedWaitMinutes: position * 3,
      joinedAt: Date.now(),
    });

    // Add self to queue count
    setQueues((prev) => {
      const q = prev[placeId];
      if (!q) return prev;
      const updated = { ...q, peopleAhead: q.peopleAhead + 1 };
      updated.waitMinutes = updated.peopleAhead * 3;
      updated.level = updated.peopleAhead <= 2 ? "low" : updated.peopleAhead <= 6 ? "medium" : "busy";
      return { ...prev, [placeId]: updated };
    });
  }, [queues]);

  const leaveQueue = useCallback(() => {
    if (userQueue) {
      setQueues((prev) => {
        const q = prev[userQueue.placeId];
        if (!q) return prev;
        const updated = { ...q, peopleAhead: Math.max(0, q.peopleAhead - 1) };
        updated.waitMinutes = updated.peopleAhead * 3;
        updated.level = updated.peopleAhead <= 2 ? "low" : updated.peopleAhead <= 6 ? "medium" : "busy";
        return { ...prev, [userQueue.placeId]: updated };
      });
    }
    setUserQueue(null);
  }, [userQueue]);

  const getQueueInfo = useCallback((placeId: string): QueueInfo | null => {
    return queues[placeId] || null;
  }, [queues]);

  return { queues, userQueue, joinQueue, leaveQueue, getQueueInfo };
}
