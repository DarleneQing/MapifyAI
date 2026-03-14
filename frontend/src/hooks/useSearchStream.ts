/**
 * useSearchStream — 搜索流 Hook
 *
 * 调用 POST /api/requests/?stream={bool}
 * - stream=false (默认): 返回 JSON { request, results }
 * - stream=true: SSE 渐进式结果（7 阶段 Agent 管道）
 *
 * 后端不可用时自动回退到 mock 数据。
 */
import { useState, useCallback, useRef } from "react";
import type { PlaceSummary, LatLng, RequestSseEvent } from "@/types";
import { createSearchRequest, subscribeRequestStream } from "@/services/api";
import { sortByPreferences } from "@/lib/preferenceScoring";
import type { UserPreferences } from "@/components/OnboardingSurvey";

// ── Mock 数据（后端未就绪时使用）──
const MOCK_PLACES: PlaceSummary[] = [
  {
    place_id: "p1",
    name: "The Ground Brew",
    address: "12 Market Street, Downtown",
    distance_km: 0.2,
    price_level: "medium",
    rating: 4.9,
    rating_count: 2341,
    recommendation_score: 0.95,
    status: "open_now",
    queue_status: "low",
    flash_deal: {
      title: "Espresso Happy Hour",
      discount: "-40%",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      remaining: 12,
    },
    transit: {
      duration_minutes: 3,
      transport_types: ["walk"],
      summary: "3 min walk",
    },
    reason_tags: ["Minimalist design", "Strong espresso"],
    one_sentence_recommendation: "Best espresso within walking distance",
  },
  {
    place_id: "p2",
    name: "Komorebi Tables",
    address: "88 Oak Avenue, Midtown",
    distance_km: 0.5,
    price_level: "medium",
    rating: 4.7,
    rating_count: 1890,
    recommendation_score: 0.91,
    status: "closing_soon",
    queue_status: "medium",
    transit: {
      duration_minutes: 7,
      transport_types: ["tram"],
      summary: "7 min — Tram 4",
    },
    reason_tags: ["High-speed WiFi", "Quiet environment"],
    one_sentence_recommendation: "Perfect for focused work sessions",
  },
  {
    place_id: "p3",
    name: "Velvet Crumb",
    address: "45 Elm Street, West End",
    distance_km: 0.8,
    price_level: "low",
    rating: 4.8,
    rating_count: 3102,
    recommendation_score: 0.88,
    status: "open_now",
    queue_status: "busy",
    flash_deal: {
      title: "Buy 2 Get 1 Free",
      discount: "3 for 2",
      expires_at: new Date(Date.now() + 1800000).toISOString(),
      remaining: 5,
    },
    transit: {
      duration_minutes: 10,
      transport_types: ["bus"],
      summary: "10 min — Bus 33",
    },
    reason_tags: ["Artisanal sourdough", "Trending"],
    one_sentence_recommendation: "Trending bakery with artisan bread",
  },
  {
    place_id: "p4",
    name: "Origin Roast",
    address: "200 Pine Road, Riverside",
    distance_km: 0.2,
    price_level: "low",
    rating: 4.6,
    rating_count: 876,
    recommendation_score: 0.84,
    status: "open_now",
    queue_status: "low",
    transit: {
      duration_minutes: 4,
      transport_types: ["walk"],
      summary: "4 min walk",
    },
    reason_tags: ["Near you", "Single origin"],
    one_sentence_recommendation: "Closest single-origin roaster",
  },
  {
    place_id: "p5",
    name: "The Sage Bistro",
    address: "Gastronomy Park, Central",
    distance_km: 1.5,
    price_level: "high",
    rating: 4.8,
    rating_count: 212,
    recommendation_score: 0.79,
    status: "open_now",
    transit: {
      duration_minutes: 14,
      transport_types: ["tram", "bus"],
      summary: "14 min — Tram 4 → Bus 33",
    },
    reason_tags: ["Farm-to-table", "Date night"],
    one_sentence_recommendation: "Top farm-to-table for special occasions",
  },
  {
    place_id: "p6",
    name: "Blue Bottle Coffee",
    address: "299 Copper Lane, Uptown",
    distance_km: 3.0,
    price_level: "high",
    rating: 4.3,
    rating_count: 654,
    recommendation_score: 0.72,
    status: "closed",
    transit: {
      duration_minutes: 25,
      transport_types: ["tram"],
      summary: "25 min — Tram 11",
    },
    reason_tags: ["Japanese minimal", "Pour-over"],
    one_sentence_recommendation: "Premium Japanese-style pour-over",
  },
];

/** SSE pipeline stage for UI progress display */
export type PipelineStage =
  | "idle"
  | "intent_parsed"
  | "stores_crawled"
  | "transit_computed"
  | "reviews_fetched"
  | "scores_computed"
  | "recommendations_ready"
  | "completed";

export function useSearchStream(userPreferences?: UserPreferences | null) {
  const [results, setResults] = useState<PlaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");
  const timerRef = useRef<number[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clearTimers = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  };

  const closeEventSource = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  };

  const startMockStream = useCallback(() => {
    setRequestId("mock-req-" + Date.now());

    // Simulate multi-agent pipeline stages with timing
    const stages: { stage: PipelineStage; delay: number }[] = [
      { stage: "intent_parsed", delay: 400 },
      { stage: "stores_crawled", delay: 1200 },
      { stage: "transit_computed", delay: 2200 },
      { stage: "reviews_fetched", delay: 3000 },
      { stage: "scores_computed", delay: 3800 },
      { stage: "recommendations_ready", delay: 4400 },
    ];

    stages.forEach(({ stage, delay }) => {
      const timer = window.setTimeout(() => setPipelineStage(stage), delay);
      timerRef.current.push(timer);
    });

    // Sort mock places by user preferences
    const sorted = sortByPreferences(MOCK_PLACES, userPreferences ?? null);

    // Start results AFTER pipeline completes (4400ms + buffer)
    const resultsStart = 4800;
    sorted.forEach((place, idx) => {
      const timer = window.setTimeout(() => {
        setResults((prev) => [...prev, place]);
        if (idx === 0) setIsLoading(false);
        if (idx === sorted.length - 1) {
          setIsStreaming(false);
          setPipelineStage("completed");
        }
      }, resultsStart + idx * 400);
      timerRef.current.push(timer);
    });
  }, [userPreferences]);

  const handleSseEvent = useCallback((event: RequestSseEvent) => {
    setPipelineStage(event.type as PipelineStage);

    switch (event.type) {
      case "intent_parsed":
        setRequestId(event.request_id);
        break;
      case "stores_crawled":
        // Initialize list with basic info
        setResults(event.results);
        setIsLoading(false);
        break;
      case "transit_computed":
      case "scores_computed":
      case "recommendations_ready":
        // Progressive update with richer data
        setResults(event.results);
        break;
      case "completed":
        // Final results
        setResults(
          event.results.sort(
            (a, b) => b.recommendation_score - a.recommendation_score
          )
        );
        setIsStreaming(false);
        closeEventSource();
        break;
    }
  }, []);

  const startSearch = useCallback(
    async (query: string, location: LatLng, options?: { language?: string; stream?: boolean }) => {
      clearTimers();
      closeEventSource();
      setResults([]);
      setIsLoading(true);
      setIsStreaming(true);
      setPipelineStage("idle");

      const useStream = options?.stream ?? false;

      try {
        const res = await createSearchRequest(query, location, {
          stream: useStream,
          language: options?.language,
        });

        if (!res.ok) throw new Error(`API returned ${res.status}`);

        if (useStream) {
          // SSE mode: parse request_id from initial response, then open EventSource
          const initData = await res.json();
          const reqId = initData.request?.id || initData.request_id;
          setRequestId(reqId);

          if (reqId) {
            eventSourceRef.current = subscribeRequestStream(
              reqId,
              handleSseEvent,
              () => {
                // SSE error → fall back to polling or mock
                console.warn("SSE connection error, falling back to mock");
                closeEventSource();
                startMockStream();
              }
            );
          }
        } else {
          // JSON mode
          const data = await res.json();
          setRequestId(data.request?.id || null);
          setResults(
            (data.results || []).sort(
              (a: PlaceSummary, b: PlaceSummary) =>
                b.recommendation_score - a.recommendation_score
            )
          );
          setIsLoading(false);
          setIsStreaming(false);
          setPipelineStage("completed");
        }
      } catch (err) {
        // 后端不可用 → 回退到 mock
        console.warn("Backend unavailable, using mock data:", err);
        startMockStream();
      }
    },
    [startMockStream, handleSseEvent]
  );

  const reset = useCallback(() => {
    clearTimers();
    closeEventSource();
    setResults([]);
    setIsLoading(false);
    setIsStreaming(false);
    setRequestId(null);
    setPipelineStage("idle");
  }, []);

  return {
    results,
    isLoading,
    isStreaming,
    requestId,
    pipelineStage,
    startSearch,
    reset,
  };
}
