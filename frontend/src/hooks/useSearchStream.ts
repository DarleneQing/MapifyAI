/**
 * useSearchStream — 搜索流 Hook
 *
 * 调用 POST /api/requests/?stream={bool}
 * - stream=false (默认): 返回 JSON { request, results }
 * - stream=true: 同一 POST 返回 text/event-stream，事件格式：
 *   progress: { type, status: "starting"|"done", agent, message }
 *   result:   { type, request, results }
 *   error:    { type, message }
 *
 * 后端不可用时自动回退到 mock 数据。
 */
import { useState, useCallback, useRef } from "react";
import type { PlaceSummary, LatLng } from "@/types";
import { createSearchRequest } from "@/services/api";
import { sortByPreferences } from "@/lib/preferenceScoring";
import type { UserPreferences } from "@/components/onboarding/OnboardingSurvey";

/** Backend POST stream event (progress / result / error) */
type StreamEvent =
  | { type: "progress"; status: string; agent: string; message?: string; duration_ms?: number }
  | { type: "result"; request?: { id?: string }; results?: PlaceSummary[]; agent_reply?: string }
  | { type: "error"; message?: string };

/** Map backend agent name to UI step index (0..5). Parallel agents map to their step. */
function agentToStepIndex(agent: string): number {
  const map: Record<string, number> = {
    intent_parser: 0,
    crawling_search: 1,
    transit_calculator: 2,
    review_agent: 3,
    evaluation_agent: 4,
    orchestrator_agent: 5,
    output_ranking: 5,
  };
  return map[agent] ?? 0;
}

function agentToStage(agent: string): PipelineStage {
  const map: Record<string, PipelineStage> = {
    intent_parser: "intent_parsed",
    crawling_search: "stores_crawled",
    transit_calculator: "transit_computed",
    review_agent: "reviews_fetched",
    evaluation_agent: "scores_computed",
    orchestrator_agent: "recommendations_ready",
    output_ranking: "recommendations_ready",
  };
  return map[agent] ?? "intent_parsed";
}

/** Ordered pipeline stages; index matches stepDurations (reviews_fetched=3, scores_computed=4). */
const STAGE_ORDER: PipelineStage[] = [
  "intent_parsed",
  "stores_crawled",
  "transit_computed",
  "reviews_fetched",
  "scores_computed",
  "recommendations_ready",
];

/** First stage that is not yet complete (no duration). Keeps "Analyzing Reviews" active until review_agent finishes. */
function firstIncompleteStage(stepDurations: (number | undefined)[]): PipelineStage {
  const i = STAGE_ORDER.findIndex((_, idx) => stepDurations[idx] == null);
  return i === -1 ? "recommendations_ready" : STAGE_ORDER[i]!;
}

// ── Mock 数据（后端未就绪时使用）──
const MOCK_PLACES: PlaceSummary[] = [
  {
    place_id: "p1",
    name: "The Ground Brew",
    address: "12 Market Street, Downtown",
    distance_km: 0.2,
    price_level: "$10–20",
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
    price_level: "$20–40",
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
    price_level: "$5–15",
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
    price_level: "CHF 15–25",
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
    price_level: "CHF 60–90",
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
    price_level: "$40–60",
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
  const [agentReply, setAgentReply] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");
  const [stepDurations, setStepDurations] = useState<(number | undefined)[]>([]);
  const stepDurationsRef = useRef<(number | undefined)[]>([]);
  const timerRef = useRef<number[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearTimers = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  };

  const closeEventSource = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  };

  const abortStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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

  const consumePostStream = useCallback(
    (
      res: Response,
      onProgress: (event: StreamEvent) => void,
      onError: () => void
    ) => {
      const reader = res.body?.getReader();
      if (!reader) {
        onError();
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";

      const run = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const dataLine = line.match(/^data:\s*(.+)$/m)?.[1];
              if (!dataLine) continue;
              try {
                const event = JSON.parse(dataLine) as StreamEvent;
                if (event.type === "error") {
                  onError();
                  return;
                }
                onProgress(event);
                if (event.type === "result") return;
              } catch {
                // ignore malformed event
              }
            }
          }
        } catch (e) {
          if ((e as Error).name !== "AbortError") {
            console.warn("Stream read error", e);
            onError();
          }
        }
      };
      run();
    },
    []
  );

  const startSearch = useCallback(
    async (query: string, location: LatLng, options?: { language?: string; stream?: boolean }) => {
      clearTimers();
      closeEventSource();
      abortStream();
      setResults([]);
      setAgentReply(null);
      setStepDurations([]);
      stepDurationsRef.current = [];
      setIsLoading(true);
      setIsStreaming(true);
      setPipelineStage("idle");

      const useStream = options?.stream ?? false;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await createSearchRequest(query, location, {
          stream: useStream,
          language: options?.language,
          preferences: userPreferences ?? undefined,
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`API returned ${res.status}`);

        if (useStream) {
          consumePostStream(
            res,
            (event) => {
              if (event.type === "progress") {
                if (event.status === "starting") {
                  // Use firstIncompleteStage so parallel agents (evaluation_agent,
                  // review_agent) don't jump the stage past steps still in progress.
                  // e.g. evaluation_agent "starting" must not show "scores_computed"
                  // while review_agent is still running in advanced mode.
                  setPipelineStage((cur) =>
                    cur === "completed"
                      ? cur
                      : firstIncompleteStage(stepDurationsRef.current)
                  );
                } else if (event.status === "done") {
                  const idx = agentToStepIndex(event.agent);
                  const prev = stepDurationsRef.current;
                  const next = [...prev];
                  while (next.length <= idx) next.push(undefined);
                  if (event.duration_ms != null) {
                    const existing = next[idx];
                    next[idx] = existing == null ? event.duration_ms : Math.max(existing, event.duration_ms);
                  }
                  stepDurationsRef.current = next;
                  setStepDurations(next);
                  // Show first incomplete stage so "Analyzing Reviews" stays active until review_agent finishes (advanced mode)
                  setPipelineStage((cur) =>
                    cur === "completed" ? cur : firstIncompleteStage(next)
                  );
                }
              } else if (event.type === "result") {
                const req = event.request;
                const list = event.results ?? [];
                setRequestId(req?.id ?? null);
                setAgentReply(event.agent_reply?.trim() || null);
                setResults(
                  [...list].sort(
                    (a, b) =>
                      (b.recommendation_score ?? 0) - (a.recommendation_score ?? 0)
                  )
                );
                setIsLoading(false);
                setIsStreaming(false);
                setPipelineStage("completed");
                abortControllerRef.current = null;
              }
            },
            () => {
              abortControllerRef.current = null;
              console.warn("SSE error or backend error, falling back to mock");
              startMockStream();
            }
          );
        } else {
          const data = await res.json();
          setRequestId(data.request?.id ?? null);
          setAgentReply((data.agent_reply as string | undefined)?.trim() || null);
          setResults(
            (data.results || []).sort(
              (a: PlaceSummary, b: PlaceSummary) =>
                (b.recommendation_score ?? 0) - (a.recommendation_score ?? 0)
            )
          );
          setIsLoading(false);
          setIsStreaming(false);
          setPipelineStage("completed");
          abortControllerRef.current = null;
        }
      } catch (err) {
        abortControllerRef.current = null;
        if ((err as Error).name !== "AbortError") {
          console.warn("Backend unavailable, using mock data:", err);
          startMockStream();
        }
      }
    },
    [startMockStream, consumePostStream, userPreferences]
  );

  const reset = useCallback(() => {
    clearTimers();
    closeEventSource();
    abortStream();
    setResults([]);
    setAgentReply(null);
    setStepDurations([]);
    stepDurationsRef.current = [];
    setIsLoading(false);
    setIsStreaming(false);
    setRequestId(null);
    setPipelineStage("idle");
  }, []);

  return {
    results,
    agentReply,
    isLoading,
    isStreaming,
    requestId,
    pipelineStage,
    stepDurations,
    startSearch,
    reset,
  };
}
