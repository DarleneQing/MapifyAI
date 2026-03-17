/**
 * Debug / Trace API — contract §7.
 */
import type { TraceResponse } from "@/types";
import { API_BASE } from "./config";

function mapAgentTraceToTraceResponse(trace: {
  request_id: string;
  steps?: Array<{ agent: string; duration_ms?: number | null; input?: unknown; output?: unknown }>;
}): TraceResponse {
  const steps = (trace.steps || []).map((step) => ({
    agent_name: step.agent,
    status: "completed",
    duration_ms: step.duration_ms ?? 0,
    input_summary: JSON.stringify(step.input ?? {}),
    output_summary: JSON.stringify(step.output ?? {}),
  }));

  return {
    trace_id: trace.request_id,
    request_id: trace.request_id,
    graph: {
      nodes: steps.map((step, index) => ({ id: `${index}`, type: step.agent_name })),
      edges: steps.slice(1).map((_, index) => ({ from: `${index}`, to: `${index + 1}` })),
    },
    steps,
    created_at: new Date().toISOString(),
  };
}

export async function getTrace(
  traceId: string
): Promise<TraceResponse> {
  const res = await fetch(`${API_BASE}/requests/${traceId}/trace`);
  if (!res.ok) throw new Error(`GET /requests/${traceId}/trace failed: ${res.status}`);
  const data = await res.json();
  return mapAgentTraceToTraceResponse(data);
}
