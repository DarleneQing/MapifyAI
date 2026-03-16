import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import DebugTracePanel from "./DebugTracePanel";

/**
 * Renders the Debug Trace Panel when ?debug=true is in the URL.
 * US-27: Hidden debug panel for internal use / demo.
 */
export default function DebugTraceWrapper() {
  const [searchParams] = useSearchParams();
  const debugMode = searchParams.get("debug") === "true";
  const traceId = searchParams.get("trace_id") || undefined;
  const [dismissed, setDismissed] = useState(false);

  if (!debugMode || dismissed) return null;

  return (
    <AnimatePresence>
      <DebugTracePanel traceId={traceId} onClose={() => setDismissed(true)} />
    </AnimatePresence>
  );
}
