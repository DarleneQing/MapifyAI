/**
 * Debug / Trace types — contract §7.
 */
export interface TraceGraphNode {
  id: string;
  type: string;
}

export interface TraceGraphEdge {
  from: string;
  to: string;
}

export interface TraceStepView {
  agent_name: string;
  status: string;
  duration_ms: number;
  input_summary: string;
  output_summary: string;
}

export interface TraceResponse {
  trace_id: string;
  request_id: string;
  graph: {
    nodes: TraceGraphNode[];
    edges: TraceGraphEdge[];
  };
  steps: TraceStepView[];
  created_at: string;
}
