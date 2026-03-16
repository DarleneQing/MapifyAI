import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, ChevronDown, ChevronUp, Bug, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { getTrace } from "@/services/api";
import type { TraceResponse, TraceStepView } from "@/types";

// Mock trace for demo
const MOCK_TRACE: TraceResponse = {
  trace_id: "trace_demo",
  request_id: "req_demo",
  graph: {
    nodes: [
      { id: "input_agent", type: "agent" },
      { id: "crawling_agent_search", type: "agent" },
      { id: "crawling_agent_transit", type: "agent" },
      { id: "review_agent", type: "agent" },
      { id: "evaluation_agent", type: "agent" },
      { id: "orchestrator_agent", type: "agent" },
      { id: "output_agent_ranking", type: "agent" },
      { id: "output_agent_recommendation", type: "agent" },
    ],
    edges: [
      { from: "input_agent", to: "crawling_agent_search" },
      { from: "input_agent", to: "review_agent" },
      { from: "crawling_agent_search", to: "crawling_agent_transit" },
      { from: "crawling_agent_transit", to: "evaluation_agent" },
      { from: "evaluation_agent", to: "orchestrator_agent" },
      { from: "review_agent", to: "orchestrator_agent" },
      { from: "orchestrator_agent", to: "output_agent_ranking" },
      { from: "orchestrator_agent", to: "output_agent_recommendation" },
    ],
  },
  steps: [
    { agent_name: "input_agent", status: "success", duration_ms: 850, input_summary: "User query: find a good coffee shop nearby", output_summary: "Parsed: coffee category, radius 3km, budget medium" },
    { agent_name: "crawling_agent_search", status: "success", duration_ms: 2100, input_summary: "Apify Google Maps: coffee, 47.37°N 8.54°E, 3km", output_summary: "Found 18 shops, filtered to 12 by hours" },
    { agent_name: "crawling_agent_transit", status: "success", duration_ms: 1500, input_summary: "SBB API: 12 destinations", output_summary: "Computed 12 transit routes (tram/bus/train)" },
    { agent_name: "review_agent", status: "success", duration_ms: 3200, input_summary: "Apify reviews: 12 places", output_summary: "Generated advantages/disadvantages for 12 places" },
    { agent_name: "evaluation_agent", status: "success", duration_ms: 800, input_summary: "12 candidates + user preferences", output_summary: "Scored all candidates, range [0.42, 0.99]" },
    { agent_name: "orchestrator_agent", status: "success", duration_ms: 1200, input_summary: "Scores + Reviews + User intent", output_summary: "Synthesized final rankings with reasons" },
    { agent_name: "output_agent_ranking", status: "success", duration_ms: 200, input_summary: "Top 10 ranked candidates", output_summary: "Formatted PlaceSummary[] for API" },
    { agent_name: "output_agent_recommendation", status: "success", duration_ms: 900, input_summary: "Top 10 candidates", output_summary: "Generated one_sentence_recommendation for each" },
  ],
  created_at: new Date().toISOString(),
};

const AGENT_LABELS: Record<string, string> = {
  input_agent: "🧠 Input Agent",
  crawling_agent_search: "🔍 Store Crawler",
  crawling_agent_transit: "🚃 Transit Calculator",
  review_agent: "📝 Review Agent",
  evaluation_agent: "⭐ Evaluation Agent",
  orchestrator_agent: "🎯 Orchestrator",
  output_agent_ranking: "📊 Ranking Formatter",
  output_agent_recommendation: "💬 Recommendation Writer",
};

// Simple DAG layout: rows based on dependency depth
const DAG_LAYOUT: Record<string, { row: number; col: number }> = {
  input_agent: { row: 0, col: 1 },
  crawling_agent_search: { row: 1, col: 0 },
  review_agent: { row: 1, col: 2 },
  crawling_agent_transit: { row: 2, col: 0 },
  evaluation_agent: { row: 3, col: 0 },
  orchestrator_agent: { row: 4, col: 1 },
  output_agent_ranking: { row: 5, col: 0 },
  output_agent_recommendation: { row: 5, col: 2 },
};

interface Props {
  traceId?: string;
  onClose: () => void;
}

export default function DebugTracePanel({ traceId, onClose }: Props) {
  const [trace, setTrace] = useState<TraceResponse>(MOCK_TRACE);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => {
    if (!traceId) return;
    getTrace(traceId).then(setTrace).catch(() => setTrace(MOCK_TRACE));
  }, [traceId]);

  const totalDuration = trace.steps.reduce((sum, s) => sum + s.duration_ms, 0);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25 }}
      className="fixed top-0 right-0 bottom-0 w-[min(380px,90vw)] z-[9999] bg-background border-l border-border shadow-2xl flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Agent Trace</h2>
        </div>
        <button onClick={onClose} className="p-1"><X className="w-5 h-5 text-muted-foreground" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Summary */}
        <div className="mb-4 p-3 rounded-xl bg-muted/30 border border-border/30">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Trace ID</span>
            <span className="font-mono text-foreground text-[10px]">{trace.trace_id}</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Total Duration</span>
            <span className="font-semibold text-foreground">{(totalDuration / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Agents</span>
            <span className="font-semibold text-foreground">{trace.steps.length}</span>
          </div>
        </div>

        {/* DAG Visualization */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 tracking-widest uppercase">Agent DAG</h3>
          <div className="relative py-2">
            {/* Render nodes in a simple grid */}
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex justify-center gap-2 mb-2">
                {trace.graph.nodes
                  .filter((n) => DAG_LAYOUT[n.id]?.row === row)
                  .sort((a, b) => (DAG_LAYOUT[a.id]?.col ?? 0) - (DAG_LAYOUT[b.id]?.col ?? 0))
                  .map((node) => {
                    const step = trace.steps.find((s) => s.agent_name === node.id);
                    const isSuccess = step?.status === "success";
                    return (
                      <div
                        key={node.id}
                        className={`px-2 py-1.5 rounded-lg text-[9px] font-medium border text-center min-w-[90px] ${
                          isSuccess
                            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300/50 dark:border-emerald-700/30 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted/30 border-border/50 text-muted-foreground"
                        }`}
                      >
                        {AGENT_LABELS[node.id] || node.id}
                        {step && <span className="block text-[8px] opacity-70">{step.duration_ms}ms</span>}
                      </div>
                    );
                  })}
              </div>
            ))}
            {/* Arrow indicators between rows */}
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={`arrow-${row}`} className="flex justify-center text-muted-foreground/40 text-xs -mt-1 mb-1">↓</div>
            ))}
          </div>
        </div>

        {/* Step Details */}
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 tracking-widest uppercase">Step Details</h3>
        <div className="space-y-1.5">
          {trace.steps.map((step) => (
            <div key={step.agent_name} className="rounded-xl border border-border/30 overflow-hidden">
              <button
                onClick={() => setExpandedStep(expandedStep === step.agent_name ? null : step.agent_name)}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  {step.status === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  )}
                  <span className="text-xs font-medium text-foreground">{AGENT_LABELS[step.agent_name] || step.agent_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" /> {step.duration_ms}ms
                  </span>
                  {expandedStep === step.agent_name ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </button>
              {expandedStep === step.agent_name && (
                <div className="px-3 pb-3 space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Input</p>
                    <p className="text-[11px] text-foreground/70 bg-muted/30 rounded-lg p-2 font-mono">{step.input_summary}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Output</p>
                    <p className="text-[11px] text-foreground/70 bg-muted/30 rounded-lg p-2 font-mono">{step.output_summary}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
